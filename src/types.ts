export interface GeneratedFile {
  name: string;
  content: string;
  /** Stable category for programmatic lookup (previews, tests) — independent of the
   * display name, which is free-form and may change (e.g. the bowl tool's
   * "Step N - ..." labels). Bowl-tool files only; ripple files leave this unset. */
  kind?: "interior-roughing" | "interior" | "exterior-roughing" | "exterior";
}
