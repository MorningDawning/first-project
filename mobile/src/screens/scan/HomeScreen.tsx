import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { BeerCard } from "../../components/BeerCard";
import { useAuth } from "../../context/AuthContext";
import { beersApi } from "../../api/beervia";
import { spacing, typography } from "../../theme/colors";
import { HomeStackParamList } from "../../navigation/types";
import { BeerSummary } from "../../types";

type Nav = NativeStackNavigationProp<HomeStackParamList, "Home">;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<BeerSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      beersApi
        .search({})
        .then((beers) => {
          const withMatch = beers.filter((b) => b.matchPercent != null);
          withMatch.sort((a, b) => (b.matchPercent ?? 0) - (a.matchPercent ?? 0));
          setRecommendations(withMatch.slice(0, 4));
        })
        .catch(() => {});
    }, [])
  );

  const firstName = user?.name?.split(" ")[0];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>{firstName ? `Привет, ${firstName}!` : "BeerVia"}</Text>
        <Text style={styles.subtitle}>Что сегодня пьём?</Text>

        {recommendations.length > 0 && (
          <View style={styles.recs}>
            <Text style={styles.sectionTitle}>Рекомендуем по вашему вкусу</Text>
            {recommendations.map((b) => (
              <BeerCard
                key={b.id}
                name={b.name}
                style={b.style}
                breweryName={b.brewery.name}
                imageUrl={b.imageUrl}
                matchPercent={b.matchPercent}
                onPress={() => navigation.navigate("BeerDetail", { beerId: b.id })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  greeting: { ...typography.title },
  subtitle: { ...typography.caption, marginTop: 2, marginBottom: spacing.lg },
  recs: {},
  sectionTitle: { ...typography.heading, marginBottom: spacing.sm },
});
