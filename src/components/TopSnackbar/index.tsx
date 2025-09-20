import React from "react";
import { Portal, Snackbar } from "react-native-paper";
import { createTheme } from "../../styles/theme";

export function TopSnackbar({
  visible,
  onDismiss,
  message,
}: {
  visible: boolean;
  onDismiss: () => void;
  message: string;
}) {
  const theme = createTheme(true);

  return (
    <Portal>
      <Snackbar
        visible={visible}
        onDismiss={onDismiss}
        duration={1800}
        wrapperStyle={{
          position: "absolute",
          top: 16,
          left: 72,
          right: 72,
        }}
        style={{
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.chipBackground,
          width: "64%",
        }}
      >
        {message}
      </Snackbar>
    </Portal>
  );
}
