import { useRef, useEffect } from 'react';
import { Animated, Platform } from 'react-native';
import { useTheme } from '../constants/ThemeContext';

export default function ScreenTransition({ children, id }) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [id]);

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        opacity: fadeAnim,
      }}
    >
      {children}
    </Animated.View>
  );
}
