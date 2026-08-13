import { Schema, Types, type Document } from "mongoose";
import { defineModel } from "@/lib/mongoose-model";

/**
 * Which schools may use a toolbox group or tool.
 *
 * "all" opens it to every school that has the 數學科「AI 解題輔助」topic; with
 * "selected" only the schools listed in `schools` may use it. The mode is stored
 * explicitly rather than inferred from an empty list, because "no schools
 * selected" then means what it says instead of silently meaning "everyone".
 */
export type SchoolScope = "all" | "selected";

export interface ITool {
  key: string;
  label: string;
  sub: string;
  icon: string;
  bg: string;
  iconBg: string;
  border: string;
  hover: string;
  text: string;
  /** Whether this individual tool is live. Defaults to true (backwards compatible). */
  isActive: boolean;
  /** Defaults to "all", so tools saved before this field existed stay open. */
  schoolScope: SchoolScope;
  /** Only read when schoolScope is "selected". */
  schools: Types.ObjectId[];
}

export interface IToolboxConfig extends Document {
  type: string;
  label: string;
  description: string;
  tools: ITool[];
  isActive: boolean;
  /** Group-level scope. A tool is usable only if its group is in scope too. */
  schoolScope: SchoolScope;
  schools: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ToolSchema = new Schema<ITool>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    sub: { type: String, required: true },
    icon: { type: String, required: true },
    bg: { type: String, required: true },
    iconBg: { type: String, required: true },
    border: { type: String, required: true },
    hover: { type: String, required: true },
    text: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    schoolScope: { type: String, enum: ["all", "selected"], default: "all" },
    schools: {
      type: [{ type: Schema.Types.ObjectId, ref: "School" }],
      default: [],
    },
  },
  { _id: false }
);

const ToolboxConfigSchema = new Schema<IToolboxConfig>(
  {
    type: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    description: { type: String, required: true },
    tools: [ToolSchema],
    isActive: { type: Boolean, default: true },
    schoolScope: { type: String, enum: ["all", "selected"], default: "all" },
    schools: {
      type: [{ type: Schema.Types.ObjectId, ref: "School" }],
      default: [],
    },
  },
  { timestamps: true }
);

export const ToolboxConfig = defineModel<IToolboxConfig>("ToolboxConfig", ToolboxConfigSchema);
