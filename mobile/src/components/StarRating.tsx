import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

type Props = {
  rating: number;
  onChange?: (rating: number) => void;
  size?: number;
};

export function StarRating({ rating, onChange, size = 18 }: Props) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <View style={styles.row}>
      {stars.map((star) => {
        const filled = star <= Math.round(rating);
        const Star = onChange ? Pressable : View;
        return (
          <Star key={star} onPress={onChange ? () => onChange(star) : undefined} hitSlop={6}>
            <Text style={{ fontSize: size, color: filled ? colors.accent : colors.border }}>★</Text>
          </Star>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 2 },
});
