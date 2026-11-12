import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { proofPhotoSource } from '../api/client';
import { t } from '../strings';
import { colors, fonts, iconSize, radius, spacing, TAP, type } from '../theme';
import { Icon } from './Icon';

// A thumbnail of the photo a caretaker took as proof; tap it to see it full screen.
export function ProofPhoto({
  token,
  completionId,
  caption,
  size = TAP,
}: {
  token: string;
  completionId: number;
  caption?: string;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const source = proofPhotoSource(token, completionId);
  const box = Math.max(size, TAP);
  const round = size > 60 ? radius.md : radius.sm;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}
        accessibilityRole="imagebutton"
        accessibilityLabel={t.photo.open(caption)}
      >
        {failed ? (
          <View style={[styles.thumb, styles.missing, { width: size, height: size, borderRadius: round }]} accessibilityLabel={t.photo.missing}>
            <Icon name="image-off-outline" size={iconSize.inline} color={colors.textMuted} />
          </View>
        ) : (
          <Image source={source} style={[styles.thumb, { width: size, height: size, borderRadius: round }]} onError={() => setFailed(true)} />
        )}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={t.photo.close}>
          <Image source={source} style={styles.full} resizeMode="contain" />
          {!!caption && <Text style={styles.caption}>{caption}</Text>}
          <View style={styles.close}>
            <Icon name="close" size={iconSize.inline} color={colors.onOverlay} />
            <Text style={styles.closeText}>{t.photo.closeHint}</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumb: { backgroundColor: colors.sunken },
  missing: { alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.md },
  full: { width: '100%', height: '72%', borderRadius: radius.lg },
  caption: { fontFamily: fonts.bodyBold, color: colors.onOverlay, fontSize: type.body, textAlign: 'center', marginTop: spacing.md },
  close: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.md },
  closeText: { fontFamily: fonts.body, color: colors.onOverlay, fontSize: type.small },
});
