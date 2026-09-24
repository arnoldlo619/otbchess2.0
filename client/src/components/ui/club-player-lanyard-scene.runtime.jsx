/* eslint-disable react/no-unknown-property */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF, useTexture } from "@react-three/drei";
import { BallCollider, CuboidCollider, Physics, RigidBody, useRopeJoint, useSphericalJoint } from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import * as THREE from "three";
import cardGLB from "./lanyard-assets/card.glb";
import defaultLanyard from "./lanyard-assets/reactbits-lanyard.png";

const BLANK_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const FRONT_UV_RECT = { x: 0, y: 0, w: 0.5, h: 0.755 };
const BACK_UV_RECT = { x: 0.5, y: 0, w: 0.5, h: 0.757 };
const FRONT_IMAGE = "/club-assets/chess-club-player-front.svg";
const BACK_IMAGE = "/club-assets/chess-club-player-back.svg";
const LANYARD_IMAGE = "/club-assets/chessotb-lanyard-band.svg";

function ClubPlayerBand() {
  const fixed = useRef(null);
  const jointOne = useRef(null);
  const jointTwo = useRef(null);
  const jointThree = useRef(null);
  const card = useRef(null);
  const [dragged, setDragged] = useState(false);
  const [hovered, setHovered] = useState(false);
  const vector = useMemo(() => new THREE.Vector3(), []);
  const angle = useMemo(() => new THREE.Vector3(), []);
  const rotation = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const [curve] = useState(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]));

  const { nodes, materials } = useGLTF(cardGLB);
  const lanyardTexture = useTexture(LANYARD_IMAGE || defaultLanyard);
  const frontTexture = useTexture(FRONT_IMAGE || BLANK_PIXEL);
  const backTexture = useTexture(BACK_IMAGE || BLANK_PIXEL);
  const lineGeometry = useMemo(() => new MeshLineGeometry(), []);
  const lineMaterial = useMemo(() => {
    const material = new MeshLineMaterial({
      color: new THREE.Color("white"),
      depthTest: false,
      map: lanyardTexture,
      useMap: 1,
      lineWidth: 0.72,
      transparent: true,
    });
    material.resolution.set(1000, 1000);
    return material;
  }, [lanyardTexture]);

  const cardMap = useMemo(() => {
    const baseMap = materials.base.map;
    const baseImage = baseMap.image;
    if (!baseImage?.width || !frontTexture.image || !backTexture.image) return baseMap;

    const canvas = document.createElement("canvas");
    canvas.width = baseImage.width;
    canvas.height = baseImage.height;
    const context = canvas.getContext("2d");
    if (!context) return baseMap;
    context.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

    const drawFitted = (image, rect) => {
      const width = rect.w * canvas.width;
      const height = rect.h * canvas.height;
      const scale = Math.max(width / image.width, height / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      context.save();
      context.beginPath();
      context.rect(rect.x * canvas.width, rect.y * canvas.height, width, height);
      context.clip();
      context.drawImage(image, rect.x * canvas.width + (width - drawWidth) / 2, rect.y * canvas.height + (height - drawHeight) / 2, drawWidth, drawHeight);
      context.restore();
    };

    drawFitted(frontTexture.image, FRONT_UV_RECT);
    drawFitted(backTexture.image, BACK_UV_RECT);
    const composite = new THREE.CanvasTexture(canvas);
    composite.colorSpace = THREE.SRGBColorSpace;
    composite.flipY = baseMap.flipY;
    composite.anisotropy = 12;
    composite.needsUpdate = true;
    return composite;
  }, [backTexture, frontTexture, materials.base.map]);

  const segmentProps = {
    type: "dynamic",
    canSleep: true,
    colliders: false,
    angularDamping: 4,
    linearDamping: 4,
  };

  useRopeJoint(fixed, jointOne, [[0, 0, 0], [0, 0, 0], 0.55]);
  useRopeJoint(jointOne, jointTwo, [[0, 0, 0], [0, 0, 0], 0.55]);
  useRopeJoint(jointTwo, jointThree, [[0, 0, 0], [0, 0, 0], 0.55]);
  useSphericalJoint(jointThree, card, [[0, 0, 0], [0, 1.45, 0]]);

  useEffect(() => {
    if (!hovered) return undefined;
    document.body.style.cursor = dragged ? "grabbing" : "grab";
    return () => { document.body.style.cursor = ""; };
  }, [dragged, hovered]);

  useFrame((state, delta) => {
    if (dragged) {
      vector.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      direction.copy(vector).sub(state.camera.position).normalize();
      vector.add(direction.multiplyScalar(state.camera.position.length()));
      [card, jointOne, jointTwo, jointThree, fixed].forEach((reference) => reference.current?.wakeUp());
      card.current?.setNextKinematicTranslation({
        x: vector.x - dragged.x,
        y: vector.y - dragged.y,
        z: vector.z - dragged.z,
      });
    }

    if (!fixed.current) return;
    [jointOne, jointTwo].forEach((reference) => {
      if (!reference.current.lerped) reference.current.lerped = new THREE.Vector3().copy(reference.current.translation());
      const lerped = reference.current.lerped;
      const distance = Math.max(0.1, Math.min(1, lerped.distanceTo(reference.current.translation())));
      lerped.lerp(reference.current.translation(), delta * (4 + distance * 28));
    });

    curve.points[0].copy(jointThree.current.translation());
    curve.points[1].copy(jointTwo.current.lerped);
    curve.points[2].copy(jointOne.current.lerped);
    curve.points[3].copy(fixed.current.translation());
    lineGeometry.setPoints(curve.getPoints(26));
    angle.copy(card.current.angvel());
    rotation.copy(card.current.rotation());
    card.current.setAngvel({ x: angle.x, y: angle.y - rotation.y * 0.22, z: angle.z }, true);
  });

  curve.curveType = "chordal";
  lanyardTexture.wrapS = lanyardTexture.wrapT = THREE.RepeatWrapping;

  return (
    <>
      <group position={[-0.84, 3.75, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody ref={jointOne} position={[0.22, 0, 0]} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody ref={jointTwo} position={[0.44, 0, 0]} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody ref={jointThree} position={[0.65, 0, 0]} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody ref={card} position={[0.84, 0, 0]} {...segmentProps} type={dragged ? "kinematicPosition" : "dynamic"}>
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={2.25}
            position={[0, -1.2, -0.05]}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            onPointerUp={(event) => {
              event.target.releasePointerCapture(event.pointerId);
              setDragged(false);
            }}
            onPointerDown={(event) => {
              event.target.setPointerCapture(event.pointerId);
              setDragged(new THREE.Vector3().copy(event.point).sub(vector.copy(card.current.translation())));
            }}
          >
            <mesh geometry={nodes.card.geometry}>
              <meshPhysicalMaterial map={cardMap} side={THREE.DoubleSide} clearcoat={1} clearcoatRoughness={0.15} roughness={0.82} metalness={0.5} />
            </mesh>
            <mesh geometry={nodes.clip.geometry} material={materials.metal} material-roughness={0.3} />
            <mesh geometry={nodes.clamp.geometry} material={materials.metal} />
          </group>
        </RigidBody>
      </group>
      <mesh geometry={lineGeometry} material={lineMaterial} />
    </>
  );
}

/** ReactBits Lanyard integration, adapted with ChessOTB surfaces and sizing. */
export default function ClubPlayerLanyardScene() {
  return (
    <div className="h-full w-full touch-none" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 20 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(0x000000), 0)}
      >
        <ambientLight intensity={Math.PI} />
        <Physics gravity={[0, -34, 0]} timeStep={1 / 60}>
          <ClubPlayerBand />
        </Physics>
        <Environment blur={0.72}>
          <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="white" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={6} color="#d7ffcd" position={[-8, 2, 12]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
    </div>
  );
}
