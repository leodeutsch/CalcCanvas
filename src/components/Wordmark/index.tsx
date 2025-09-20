import React from "react";
import Svg, { G, Rect, Text as SvgText } from "react-native-svg";
import { Theme } from "../../styles/theme";

const WordmarkLight: React.FC<{
  height?: number;
  tracking?: number;
  gapAdjust?: number;
  textColor?: string;
  accentColor?: string;
}> = ({
  height = 40, // size
  tracking = 0.6, // “letter-spacing”
  gapAdjust = 0, // distance
  textColor,
  accentColor,
}) => {
  const W = 720;
  const H = 160;

  const xCalc = 20;
  const xCanvasBase = 230;
  const xCanvas = xCanvasBase + gapAdjust;
  const y = 108;
  const fs = 72;

  const aspect = W / H;
  const finalW = height * aspect;
  const finalH = height;

  return (
    <Svg width={finalW} height={finalH} viewBox={`0 0 ${W} ${H}`} fill="none">
      <Rect width={W} height={H} fill="none" />
      <G>
        <SvgText
          x={xCalc}
          y={y}
          fontFamily="Space Grotesk, Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fontWeight="600"
          fontSize={fs}
          letterSpacing={tracking}
          fill="#0F172A"
        >
          Calc
        </SvgText>
        <SvgText
          x={xCanvas}
          y={y}
          fontFamily="Space Grotesk, Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fontWeight="700"
          fontSize={fs}
          letterSpacing={tracking}
          fill={textColor ?? "#2563EB"}
        >
          Canvas
        </SvgText>
        <Rect
          x={xCanvas}
          y={118}
          width={264}
          height={6}
          rx={3}
          fill={accentColor ?? "#22D3EE"}
          opacity={0.9}
        />
      </G>
    </Svg>
  );
};

const WordmarkDark: React.FC<{
  height?: number;
  tracking?: number;
  gapAdjust?: number;
  textColor?: string;
  accentColor?: string;
}> = ({
  height = 40,
  tracking = 0.6,
  gapAdjust = 0,
  textColor,
  accentColor,
}) => {
  const W = 720;
  const H = 160;
  const xCalc = 20;
  const xCanvasBase = 230;
  const xCanvas = xCanvasBase + gapAdjust;
  const y = 108;
  const fs = 72;

  const aspect = W / H;
  const finalW = height * aspect;
  const finalH = height;

  return (
    <Svg width={finalW} height={finalH} viewBox={`0 0 ${W} ${H}`} fill="none">
      <Rect width={W} height={H} fill="none" />
      <G>
        <SvgText
          x={xCalc}
          y={y}
          fontFamily="Space Grotesk, Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fontWeight="600"
          fontSize={fs}
          letterSpacing={tracking}
          fill="#E2E8F0"
        >
          Calc
        </SvgText>
        <SvgText
          x={xCanvas}
          y={y}
          fontFamily="Space Grotesk, Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"
          fontWeight="700"
          fontSize={fs}
          letterSpacing={tracking}
          fill={textColor ?? "#60A5FA"}
        >
          Canvas
        </SvgText>
        <Rect
          x={xCanvas}
          y={118}
          width={264}
          height={6}
          rx={3}
          fill={accentColor ?? "#67E8F9"}
        />
      </G>
    </Svg>
  );
};

export const Wordmark: React.FC<{
  theme: Theme;
  height?: number;
  tracking?: number;
  gapAdjust?: number;
  textColor?: string;
  accentColor?: string;
}> = ({ theme, height, tracking, gapAdjust, textColor, accentColor }) => {
  return theme.isDark ? (
    <WordmarkDark
      height={height}
      tracking={tracking}
      gapAdjust={gapAdjust}
      textColor={textColor}
      accentColor={accentColor}
    />
  ) : (
    <WordmarkLight
      height={height}
      tracking={tracking}
      gapAdjust={gapAdjust}
      textColor={textColor}
      accentColor={accentColor}
    />
  );
};
