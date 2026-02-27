
/*
CODIGO DO RICHARD NAO COLOCA A MAO!!!!!!
CODIGO DO RICHARD NAO COLOCA A MAO!!!!!!
CODIGO DO RICHARD NAO COLOCA A MAO!!!!!!
CODIGO DO RICHARD NAO COLOCA A MAO!!!!!!
import { PropsWithChildren, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { setRateLimitHandler } from "@/app/config/api";

type RateLimitState = {
  visible: boolean;
  message: string;
  retryAfterSeconds: number;
  cooldownLevel?: "seconds" | "hours";
};

const initialState: RateLimitState = {
  visible: false,
  message: "",
  retryAfterSeconds: 0,
};

function formatRetryText(seconds: number, cooldownLevel?: "seconds" | "hours") {
  if (cooldownLevel === "hours" || seconds >= 3600) {
    const hours = Math.max(1, Math.ceil(seconds / 3600));
    return `Bloqueado por cerca de ${hours} hora(s).`;
  }

  const secs = Math.max(1, Math.ceil(seconds));
  return `Aguarde ${secs} segundo(s) antes de tentar de novo.`;
}

export function RateLimitProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<RateLimitState>(initialState);

  useEffect(() => {
    setRateLimitHandler((payload) => {
      setState({
        visible: true,
        message:
          payload.message ?? "Muitas tentativas. Espere um pouco e tente novamente.",
        retryAfterSeconds: payload.retryAfterSeconds ?? 0,
        cooldownLevel: payload.cooldownLevel,
      });
    });

    return () => {
      setRateLimitHandler(null);
    };
  }, []);

  const retryText = useMemo(
    () => formatRetryText(state.retryAfterSeconds, state.cooldownLevel),
    [state.cooldownLevel, state.retryAfterSeconds]
  );

  return (
    <>
      {children}
      <Modal transparent visible={state.visible} animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.title}>Calma ai</Text>
            <Text style={styles.body}>{state.message}</Text>
            <Text style={styles.retryText}>{retryText}</Text>

            <Pressable
              style={styles.button}
              onPress={() => setState((current) => ({ ...current, visible: false }))}
            >
              <Text style={styles.buttonText}>Entendi</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.55)",
    justifyContent: "center",
    padding: 22,
  },
  modal: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 18,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  body: {
    color: "#334155",
    fontSize: 15,
    lineHeight: 22,
  },
  retryText: {
    color: "#b91c1c",
    fontSize: 14,
    fontWeight: "600",
  },
  button: {
    marginTop: 4,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1d4ed8",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});

*/