# Phase 3 UI Design Contract (`03-UI-SPEC.md`)

- **Aesthetic**: Apple Human Interface Guidelines (macOS Sequoia & iPadOS 18). Not derived from the assignment wireframe.
- **Styling Rule**: 100% Vanilla CSS Modules (`*.module.css`) + `tokens.css`. Zero Tailwind, zero JSX inline `style={{}}` attributes.
- **Typography**: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', system-ui, sans-serif` with tight `-0.025em` display tracking.
- **Surfaces & Vibrancy**: Grouped canvas (`#F5F5F7` light / `#09090D` dark), elevated cards (`#FFFFFF` / `#16161A`), frosted chrome (`backdrop-filter: blur(24px) saturate(180%)`), hairline `1px` borders, `14px`–`22px` squircle radii, layered ambient shadows.
- **Visualizations**: Pure SVG Activity-ring workload gauges (`strokeDasharray` / `strokeDashoffset` XML attributes) and SVG segmented bars/donuts — zero inline DOM styles.
- **Responsive Breakpoints**: Desktop `>1024px` (macOS frosted sidebar), Tablet `768–1024px` (compact rail), Mobile `<768px` (iOS bottom tab bar + card stack).
