import React, { useRef, useEffect } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const loduPNG = require('../../assets/images/loduPNG.png');

const SIZE = 180;
const HALO_SIZE = 220;
const HALO_WIDTH = 10;

export default function Index() {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Aureola com gradiente animado */}
      <Animated.View
        style={[
          styles.haloWrapper,
          { transform: [{ rotate: spin }] }
        ]}
      >
        <LinearGradient
          colors={['#014421', '#001f00ff', '#0f2c1cff', '#014421']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.haloGradient}
        />
        {/* Centro preto para esconder o gradiente e deixar só a borda */}
        <View style={styles.haloInner} />
      </Animated.View>
      <Image source={loduPNG} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: SIZE,
    height: SIZE,
    zIndex: 2,
  },
  haloWrapper: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  haloGradient: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
  },
  haloInner: {
    position: 'absolute',
    top: HALO_WIDTH,
    left: HALO_WIDTH,
    width: HALO_SIZE - HALO_WIDTH * 2,
    height: HALO_SIZE - HALO_WIDTH * 2,
    borderRadius: (HALO_SIZE - HALO_WIDTH * 2) / 2,
    backgroundColor: '#000',
  },
});