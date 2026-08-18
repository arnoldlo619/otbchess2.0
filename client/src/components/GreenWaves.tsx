import { useEffect, useRef } from "react";

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Adapted to the club surface from the supplied Green Waves shader brief.
// It intentionally uses a compact uniform contract to keep live club pages fast.
const FRAGMENT_SHADER = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(17.0, 9.2);
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  p = mat2(0.806, 0.592, -0.592, 0.806) * p * 2.0 + vec2(0.11, -0.19);

  float organic = fbm(p * 1.536 + u_time * 0.035) - 0.5;
  float waves = sin(uv.x * 7.85 - u_time * 0.58 + organic * 5.2) * 0.094;
  waves += sin(uv.x * 15.0 + u_time * 0.34 + organic * 4.0) * 0.025;
  float field = clamp(uv.y + waves + organic * 0.32, 0.0, 1.0);

  vec3 deep = vec3(0.035, 0.106, 0.059);
  vec3 forest = vec3(0.106, 0.302, 0.165);
  vec3 green = vec3(0.243, 0.557, 0.255);
  vec3 lime = vec3(0.780, 0.957, 0.392);
  vec3 color = mix(deep, forest, smoothstep(0.04, 0.48, field));
  color = mix(color, green, smoothstep(0.28, 0.72, field) * 0.80);
  color = mix(color, lime, smoothstep(0.73, 1.0, field) * 0.35);

  float lightBand = smoothstep(0.20, 0.96, field) * 0.09;
  color += vec3(0.18, 0.44, 0.20) * lightBand;
  float vignette = length(uv - 0.5) * 1.4142;
  color *= 1.0 - 0.22 * smoothstep(0.35, 1.0, vignette);
  float grain = hash21(gl_FragCoord.xy + vec2(4012.0, 218.0)) - 0.5;
  color += grain * 0.035;
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

interface GreenWavesProps {
  className?: string;
}

/**
 * Club-ready Green Waves shader. The canvas idles when hidden and renders a
 * still, high-contrast frame when the visitor requests reduced motion.
 */
export function GreenWaves({ className }: GreenWavesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
    if (!gl) return;

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };

    const vertex = createShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const buffer = gl.createBuffer();
    const position = gl.getAttribLocation(program, "a_position");
    const resolution = gl.getUniformLocation(program, "u_resolution");
    const time = gl.getUniformLocation(program, "u_time");
    if (!buffer || position < 0 || !resolution || !time) return;

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let visible = document.visibilityState === "visible";
    let inView = true;
    let disposed = false;
    const startedAt = performance.now();

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rawWidth = Math.max(1, Math.round(bounds.width * dpr));
      const rawHeight = Math.max(1, Math.round(bounds.height * dpr));
      const scale = Math.min(1, Math.sqrt(2_000_000 / (rawWidth * rawHeight)));
      const width = Math.max(1, Math.round(rawWidth * scale));
      const height = Math.max(1, Math.round(rawHeight * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const draw = (now: number) => {
      frame = 0;
      if (disposed || !visible || !inView) return;
      resize();
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, reducedMotion.matches ? 0 : (now - startedAt) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reducedMotion.matches) frame = requestAnimationFrame(draw);
    };

    const requestDraw = () => {
      if (!disposed && visible && inView && frame === 0) frame = requestAnimationFrame(draw);
    };
    const onReducedMotion = () => requestDraw();
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible) requestDraw();
    };
    const observer = new ResizeObserver(requestDraw);
    const intersection = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true;
      if (inView) requestDraw();
      else if (frame) { cancelAnimationFrame(frame); frame = 0; }
    });

    observer.observe(canvas);
    intersection.observe(canvas);
    reducedMotion.addEventListener("change", onReducedMotion);
    document.addEventListener("visibilitychange", onVisibility);
    requestDraw();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      reducedMotion.removeEventListener("change", onReducedMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} style={{ display: "block", width: "100%", height: "100%" }} />;
}
