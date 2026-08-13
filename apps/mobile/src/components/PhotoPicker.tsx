/**
 * PhotoPicker — tap to choose + upload an image, shown as a thumbnail.
 *
 * Wraps lib/uploads.pickAndUploadImage so each screen doesn't reimplement the
 * pick → presign → upload → error flow. Single-image field; callers needing a
 * multi-photo grid (post-parcel) call pickAndUploadImage directly and manage
 * an array.
 *
 * The parent owns the resulting objectUrl via onUploaded; this component only
 * holds its own preview URI + loading state. The preview uses the picker's
 * local file URI (always displayable, even when the bucket is private) rather
 * than the stored objectUrl.
 */
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { pickAndUploadImage, type UploadPurpose } from "../lib/uploads";
import { ApiError } from "../lib/api";

interface PhotoPickerProps {
  label: string;
  purpose: UploadPurpose;
  onUploaded: (objectUrl: string) => void;
  onClear?: () => void;
}

export function PhotoPicker({
  label,
  purpose,
  onUploaded,
  onClear,
}: PhotoPickerProps) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function pick() {
    if (uploading) return;
    setUploading(true);
    try {
      const picked = await pickAndUploadImage(purpose);
      if (!picked) return; // user canceled
      setLocalUri(picked.localUri);
      onUploaded(picked.objectUrl);
    } catch (e) {
      Alert.alert(
        "Envoi impossible",
        e instanceof ApiError ? e.message : "Réessayez plus tard.",
      );
    } finally {
      setUploading(false);
    }
  }

  function clear() {
    setLocalUri(null);
    onClear?.();
  }

  return (
    <View className="gap-1">
      <Text className="text-mist/70 text-xs font-body uppercase">{label}</Text>
      {localUri ? (
        <View className="flex-row items-center gap-md">
          <Image
            source={{ uri: localUri }}
            className="h-20 w-20 rounded-xl bg-navySoft"
            resizeMode="cover"
          />
          <View className="flex-1 gap-1">
            <Text className="text-success font-body text-xs">
              Photo ajoutée ✓
            </Text>
            {onClear ? (
              <Pressable onPress={clear} hitSlop={8}>
                <Text className="text-danger font-body text-xs">Retirer</Text>
              </Pressable>
            ) : null}
          </View>
          {uploading ? <ActivityIndicator /> : null}
        </View>
      ) : (
        <Pressable
          onPress={pick}
          disabled={uploading}
          className="h-20 items-center justify-center rounded-xl border border-dashed border-mist/30 bg-navySoft"
        >
          {uploading ? (
            <ActivityIndicator />
          ) : (
            <Text className="text-muted font-body text-sm">
              Choisir une photo
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
