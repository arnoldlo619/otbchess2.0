import { ImageCropDialog } from "@/components/ImageCropDialog";

interface AvatarCropModalProps {
  /** Raw data URL of the selected image. */
  imageSrc: string | null;
  /** Called with the final 256×256 JPEG data URL after the user confirms their crop. */
  onApply: (croppedDataUrl: string) => void | Promise<void>;
  /** Called when the user cancels. */
  onCancel: () => void;
}

/**
 * Backward-compatible profile-avatar cropper backed by the platform-wide image editor.
 */
export function AvatarCropModal({ imageSrc, onApply, onCancel }: AvatarCropModalProps) {
  return (
    <ImageCropDialog
      imageSrc={imageSrc}
      title="Crop profile photo"
      description="Drag to reposition and scale your photo before saving it."
      aspect={1}
      cropShape="round"
      output={{ width: 256, height: 256, quality: 0.88 }}
      onApply={onApply}
      onCancel={onCancel}
    />
  );
}
