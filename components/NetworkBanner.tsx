import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStore } from '@/store/networkStore';

const HIDE_OFFSET = -120;

export default function NetworkBanner() {
  const insets = useSafeAreaInsets();
  const { status } = useNetworkStore();
  const translateY = useRef(new Animated.Value(HIDE_OFFSET)).current;
  const prevStatus = useRef<string>('online');
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = status;

    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }

    if (status === 'offline') {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 160,
      }).start();
      return;
    }

    if (status === 'restored' && prev === 'offline') {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 160,
      }).start();

      hideTimer.current = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: HIDE_OFFSET,
          duration: 260,
          useNativeDriver: true,
        }).start();
      }, 2000);
      return;
    }

    if (status === 'online') {
      translateY.setValue(HIDE_OFFSET);
    }
  }, [status]);

  const isOffline = status === 'offline';

  return (
    <Animated.View
      style={[
        styles.pill,
        {
          backgroundColor: isOffline ? '#8B0000' : '#14532d',
          top: insets.top + 14,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.text}>
        {isOffline ? 'Network offline.' : 'Network restored.'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 99999,
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  text: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
});