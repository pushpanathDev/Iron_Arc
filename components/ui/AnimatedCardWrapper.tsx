import { useEffect, useRef } from "react";
import { Animated } from "react-native";

interface AnimatedCardWrapperProps {
  children: React.ReactNode;
  delay?: number; // delay for staggered animation
}

export default function AnimatedCardWrapper({ children, delay = 0 }: AnimatedCardWrapperProps) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      {children}
    </Animated.View>
  );
}
