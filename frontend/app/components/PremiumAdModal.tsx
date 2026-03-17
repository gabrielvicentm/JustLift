import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type PremiumAdModalProps = {
  visible: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
};

const GOLD_BORDER = ["#FDE68A", "#F8C84A", "#B45309"] as const;
const GOLD_GLOW = ["rgba(253, 230, 138, 0.45)", "rgba(245, 158, 11, 0.15)", "transparent"] as const;
const BENEFITS = [
  "Sem anúncios",
  "Banners exclusivos",
  "Mudar a cor do seu perfil",
  "Exercícios personalizados ilimitados",
  "Treinos ilimitados (grátis: 3x por semana)",
  "Boost de pontos 2x",
  "Retrospectiva semanal, mensal e anual",
];

export default function PremiumAdModal({ visible, onClose, onUpgrade }: PremiumAdModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <LinearGradient colors={GOLD_BORDER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.border}>
          <View style={styles.card}>
            <LinearGradient
              colors={GOLD_GLOW}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.glow}
            />

            <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Fechar anúncio premium">
              <Text style={styles.closeText}>×</Text>
            </Pressable>

            <View style={styles.header}>
              <Text style={styles.kicker}>PREMIUM</Text>
              <Text style={styles.title}>Eleve seus treinos ao máximo</Text>
              <Text style={styles.subtitle}>Desbloqueie benefícios épicos:</Text>
            </View>

            <View style={styles.benefits}>
              {BENEFITS.map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <Ionicons name="sparkles" size={16} color="#FDE68A" />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            <LinearGradient colors={GOLD_BORDER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaBorder}>
              <Pressable
                style={styles.ctaButton}
                onPress={onUpgrade}
                disabled={!onUpgrade}
                accessibilityRole="button"
              >
                <Text style={styles.ctaText}>Assinar Premium</Text>
              </Pressable>
            </LinearGradient>

            <Text style={styles.footerNote}>Cancele quando quiser. Invista no seu progresso.</Text>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 5, 8, 0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  border: {
    width: "90%",
    height: "90%",
    borderRadius: 28,
    padding: 2,
    shadowColor: "#FDE68A",
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  card: {
    flex: 1,
    borderRadius: 26,
    padding: 20,
    overflow: "hidden",
    backgroundColor: "#120804",
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(253, 230, 138, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(253, 230, 138, 0.4)",
  },
  closeText: {
    color: "#FDE68A",
    fontSize: 24,
    fontWeight: "800",
    marginTop: -2,
  },
  header: {
    marginTop: 24,
    gap: 8,
  },
  kicker: {
    color: "#FDE68A",
    letterSpacing: 2.5,
    fontWeight: "800",
    fontSize: 12,
  },
  title: {
    color: "#FFF7E0",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#F8D37A",
    fontSize: 15,
    fontWeight: "600",
  },
  benefits: {
    marginTop: 18,
    gap: 12,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: "rgba(253, 230, 138, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(253, 230, 138, 0.2)",
  },
  benefitText: {
    color: "#FFF7E0",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  ctaBorder: {
    marginTop: 18,
    borderRadius: 16,
    padding: 1.5,
    shadowColor: "#FDE68A",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaButton: {
    borderRadius: 14,
    backgroundColor: "#2B1404",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: "#FDE68A",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  footerNote: {
    marginTop: 12,
    color: "rgba(253, 230, 138, 0.75)",
    fontSize: 12,
    textAlign: "center",
  },
});
