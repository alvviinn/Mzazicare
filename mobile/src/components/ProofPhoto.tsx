import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { proofPhotoSource } from '../api/client';
import { colors, radius, spacing } from '../theme';
import { Icon } from './Icon';

// A small thumbnail of the photo a caretaker took as proof; tap it to see it full screen.
export function ProofPhoto({
  token,
  completionId,
  caption,
  size = 48,
}: {
  token: string;
  completionId: number;
  caption?: string;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const source = proofPhotoSource(token, completionId);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={6} accessibilityLabel="See the proof photo">
        {failed ? (
          <View style={[styles.thumb, styles.missing, { width: size, height: size }]}>
            <Icon name="image-off-outline" size={20} color={colors.textMuted} />
          </View>
        ) : (
          <Image source={source} style={[styles.thumb, { width: size, height: size }]} onError={() => setFailed(true)} />
        )}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Image source={source} style={styles.full} resizeMode="contain" />
          {!!caption && <Text style={styles.caption}>{caption}</Text>}
          <Text style={styles.close}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumb: { borderRadius: 8, backgroundColor: colors.border },
  missing: { alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', padding: spacing.md },
  full: { width: '100%', height: '75%', borderRadius: radius.md },
  caption: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', marginTop: spacing.md },
  close: { color: '#ccc', fontSize: 13, textAlign: 'center', marginTop: spacing.sm },
});
