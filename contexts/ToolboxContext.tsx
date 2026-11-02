"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  Plus,
  Minus,
  X,
  Divide,
  Variable,
  Clock,
  Timer,
  Layers,
  ArrowLeftRight,
  ArrowUpDown,
  Box,
  Grid3x3,
  Repeat,
  type LucideIcon,
} from "lucide-react";
import type { MathToolStep } from "@/lib/math-tool-steps";

export interface ToolFromDB {
  key: string;
  label: string;
  sub: string;
  icon: string;
  bg: string;
  iconBg: string;
  border: string;
  hover: string;
  text: string;
}

export const toolIconMap: Record<string, LucideIcon> = {
  Plus,
  Minus,
  X,
  Divide,
  Variable,
  Clock,
  Timer,
  Layers,
  ArrowLeftRight,
  ArrowUpDown,
  Box,
  Grid3x3,
  Repeat,
};

export interface ToolGroup {
  label: string;
  tools: ToolFromDB[];
}

interface ToolboxData {
  tools: ToolFromDB[];
  allToolGroups: ToolGroup[];
  typeLabel: string;
  question: string;
  questionImage: string | null;
  recommendedToolKeys: string[];
  /** AI 拆解出的解題步驟，每一步對應一個工具和這一步的數字。 */
  recommendedSteps: MathToolStep[];
  /** True while the AI is still analyzing the question for tool recommendations. */
  isAnalyzingTools: boolean;
}

interface ToolboxContextValue extends ToolboxData {
  selectedTool: string | null;
  /** 從「AI 推薦工具」的步驟開啟時是步驟的 index；從「全部工具」開啟時為 null。 */
  selectedStepIndex: number | null;
  setSelectedTool: (key: string | null, stepIndex?: number | null) => void;
  register: (data: ToolboxData) => void;
}

const ToolboxContext = createContext<ToolboxContextValue | null>(null);

export function useToolbox() {
  return useContext(ToolboxContext);
}

export function ToolboxProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ToolboxData>({
    tools: [],
    allToolGroups: [],
    typeLabel: "",
    question: "",
    questionImage: null,
    recommendedToolKeys: [],
    recommendedSteps: [],
    isAnalyzingTools: false,
  });
  const [selection, setSelection] = useState<{ tool: string | null; stepIndex: number | null }>({
    tool: null,
    stepIndex: null,
  });

  const setSelectedTool = useCallback((key: string | null, stepIndex: number | null = null) => {
    setSelection({ tool: key, stepIndex: key ? stepIndex : null });
  }, []);

  const register = useCallback((newData: ToolboxData) => {
    setData(newData);
  }, []);

  return (
    <ToolboxContext.Provider
      value={{
        ...data,
        selectedTool: selection.tool,
        selectedStepIndex: selection.stepIndex,
        setSelectedTool,
        register,
      }}
    >
      {children}
    </ToolboxContext.Provider>
  );
}
