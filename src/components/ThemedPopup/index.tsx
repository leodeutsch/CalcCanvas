import * as React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Button,
  Dialog,
  Portal,
  useTheme as usePaperTheme,
} from "react-native-paper";
import type { Theme } from "../../styles/theme";

export type DialogVariant =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "confirm";

export type DialogAction = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "destructive";
  testID?: string;
};

type Props = {
  theme: Theme; // seu tema (spacing/radii)
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  message?: string;
  variant?: DialogVariant;
  actions?: DialogAction[];
  /** opcional: largura máxima no tablet/desk */
  maxWidth?: number;
};

export const ThemedPopup: React.FC<Props> = ({
  theme,
  visible,
  onDismiss,
  title,
  message,
  variant = "info",
  actions = [],
  maxWidth = 420,
}) => {
  const paper = usePaperTheme();

  // === TONS por variant (usa Paper theme + suas coresFlat) ===
  const tone = React.useMemo(() => {
    const c = paper.colors;
    switch (variant) {
      case "success":
        return {
          accent: String(theme.colorsFlat.success),
          title: c.onSurface,
          subtitle: c.onSurfaceVariant,
          badgeBg: `${theme.colorsFlat.success}1A`, // ~10% alpha
          border: theme.colorsFlat.border,
        };
      case "warning":
        // usa "error" claro como destaque (ou ajuste pra um amber se quiser no futuro)
        return {
          accent: "#F59E0B",
          title: c.onSurface,
          subtitle: c.onSurfaceVariant,
          badgeBg: "#F59E0B1A",
          border: theme.colorsFlat.border,
        };
      case "error":
        return {
          accent: String(theme.colorsFlat.error),
          title: c.onSurface,
          subtitle: c.onSurfaceVariant,
          badgeBg: `${theme.colorsFlat.error}1A`,
          border: theme.colorsFlat.border,
        };
      case "confirm":
        return {
          accent: String(theme.colorsFlat.primary),
          title: c.onSurface,
          subtitle: c.onSurfaceVariant,
          badgeBg: `${theme.colorsFlat.primary}1A`,
          border: theme.colorsFlat.border,
        };
      case "info":
      default:
        return {
          accent: String(theme.colorsFlat.accent ?? theme.colorsFlat.primary),
          title: c.onSurface,
          subtitle: c.onSurfaceVariant,
          badgeBg: `${theme.colorsFlat.accent ?? theme.colorsFlat.primary}1A`,
          border: theme.colorsFlat.border,
        };
    }
  }, [paper.colors, theme.colorsFlat, variant]);

  // === mapeia variante dos botões para modo/cores do Paper ===
  const renderAction = (a: DialogAction, idx: number) => {
    const common = { style: [styles.btn, { marginLeft: theme.spacing.sm }] };

    if (a.variant === "destructive") {
      return (
        <Button
          key={`${a.label}-${idx}`}
          mode="contained"
          onPress={a.onPress}
          {...common}
          buttonColor={String(theme.colorsFlat.error)}
          textColor="#FFFFFF"
          testID={a.testID}
        >
          {a.label}
        </Button>
      );
    }

    if (a.variant === "secondary") {
      return (
        <Button
          key={`${a.label}-${idx}`}
          mode="outlined"
          onPress={a.onPress}
          {...common}
          textColor={String(paper.colors.onSurface)}
          style={[
            common.style,
            { borderColor: String(theme.colorsFlat.border) },
          ]}
        >
          {a.label}
        </Button>
      );
    }

    // primary (default)
    return (
      <Button
        key={`${a.label}-${idx}`}
        mode="contained"
        onPress={a.onPress}
        {...common}
        buttonColor={String(theme.colorsFlat.primary)}
        textColor="#FFFFFF"
      >
        {a.label}
      </Button>
    );
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[
          styles.dialog,
          {
            borderRadius: theme.radii.lg,
            maxWidth,
            alignSelf: "center",
            backgroundColor: theme.colorsFlat.surface,
          },
        ]}
      >
        {title ? (
          <Dialog.Title
            style={[
              styles.title,
              {
                color: tone.title,
                marginBottom: theme.spacing.xs,
                marginTop: theme.spacing.xl,
              },
            ]}
          >
            {title}
          </Dialog.Title>
        ) : null}

        {message ? (
          <Dialog.Content>
            <Text
              style={[
                styles.message,
                { color: tone.subtitle, marginBottom: theme.spacing.md },
              ]}
            >
              {message}
            </Text>
          </Dialog.Content>
        ) : null}

        {/* Ações alinhadas à direita */}
        <Dialog.Actions
          style={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.lg,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            {actions.map(renderAction)}
          </View>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    width: "90%",
    paddingTop: 0, // vamos usar a barra de acento no topo
  },
  accentBar: {
    height: 4,
    width: "100%",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
  },
  btn: {
    minWidth: 96,
  },
});
