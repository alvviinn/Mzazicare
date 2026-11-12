import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { proofPhotoSource } from '../api/client';
import { t } from '../strings';
import { colors, icon, on, radius, shade, space, TAP, text } from '../theme';
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

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}
        accessibilityRole="imagebutton"
        accessibilityLabel={t.photo.open(caption)}
      >
        {failed ? (
          <View style={[styles.thumb, styles.missing, { width: size, height: size }]} accessibilityLabel={t.photo.missing}>
            <Icon name="imageOff" size={icon.s} color={colors.inkMuted} />
          </View>
        ) : (
          <Image source={source} style={[styles.thumb, { width: size, height: size }]} onError={() => setFailed(true)} />
        )}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={t.photo.close}>
          <Image source={source} style={styles.full} resizeMode="contain" />
          {!!caption && <Text style={[text.bodyStrong, styles.light]}>{caption}</Text>}
          <View style={styles.close}>
            <Icon name="close" size={icon.s} color={on.secondary} />
            <Text style={[text.caption, styles.light]}>{t.photo.closeHint}</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumb: { backgroundColor: colors.line, borderRadius: radius.small },
  missing: { alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: shade.photo, justifyContent: 'center', padding: space.m, gap: space.m },
  full: { width: '100%', height: '72%', borderRadius: radius.card },
  light: { color: on.secondary, textAlign: 'center' },
  close: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s },
});
