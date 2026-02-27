import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAppTheme } from "@/providers/ThemeProvider";
import { useI18n } from "@/providers/I18nProvider";
import type { AppTheme } from "@/theme/theme";

const PRESET_COLORS = [
  "#f6f8fb",
  "#0b1220",
  "#1f2937",
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0ea5e9",
  "#111827",
  "#ffffff",
  "#cbd5e1",
];

function isValidHexColor(value: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

export default function ThemeCustomizationScreen() {
  const { theme, overrides, setBackgroundColor, setBorderColor, setButtonColor } = useAppTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [backgroundInput, setBackgroundInput] = useState(overrides.appBackground ?? "");
  const [borderInput, setBorderInput] = useState(overrides.border ?? "");
  const [buttonInput, setButtonInput] = useState(overrides.button ?? "");

  const renderColorPicker = (
    label: string,
    value: string,
    setInput: (value: string) => void,
    apply: (color?: string) => void,
  ) => {
    const selected = value.trim().toLowerCase();

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{label}</Text>

        <TextInput
          value={value}
          onChangeText={(raw) => {
            setInput(raw);
            const clean = raw.trim();

            if (!clean) {
              apply(undefined);
              return;
            }

            if (isValidHexColor(clean)) {
              apply(clean);
            }
          }}
          placeholder="#2563eb"
          placeholderTextColor={theme.colors.mutedText}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteRow}>
          {PRESET_COLORS.map((color) => (
            <Pressable
              key={`${label}-${color}`}
              onPress={() => {
                setInput(color);
                apply(color);
              }}
              style={[
                styles.colorSwatch,
                { backgroundColor: color },
                selected === color.toLowerCase() && styles.colorSwatchSelected,
              ]}
            />
          ))}
        </ScrollView>

        <Pressable
          onPress={() => {
            setInput("");
            apply(undefined);
          }}
          style={styles.resetButton}
        >
          <Text style={styles.resetButtonText}>{t("theme_custom_reset")}</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t("theme_custom_title")}</Text>
      <Text style={styles.subtitle}>{t("theme_custom_subtitle")}</Text>

      {renderColorPicker(
        t("theme_custom_app_background"),
        backgroundInput,
        setBackgroundInput,
        setBackgroundColor,
      )}
      {renderColorPicker(t("theme_custom_border_color"), borderInput, setBorderInput, setBorderColor)}
      {renderColorPicker(t("theme_custom_button_color"), buttonInput, setButtonInput, setButtonColor)}
    </ScrollView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: 16,
      gap: 14,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    subtitle: {
      color: theme.colors.mutedText,
    },
    section: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.text,
    },
    paletteRow: {
      gap: 10,
      paddingVertical: 4,
      paddingRight: 2,
    },
    colorSwatch: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    colorSwatchSelected: {
      borderColor: theme.colors.text,
    },
    resetButton: {
      alignSelf: "flex-start",
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBackground,
    },
    resetButtonText: {
      color: theme.colors.text,
      fontWeight: "600",
    },
  });
}
