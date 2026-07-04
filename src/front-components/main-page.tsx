import { defineFrontComponent } from 'twenty-sdk/define';
import { useState } from 'react';

import {
  APP_DISPLAY_NAME,
  MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

const DOCS_BASE_URL = 'https://docs.twenty.com/developers/extend/apps';

// The Remote DOM / Web Worker sandbox cannot bundle `twenty-sdk/ui` React
// components — importing them throws `Dynamic require of "react" is not
// supported` at runtime. So the icons and avatar below are plain inline SVG /
// div, exactly like the other front components in this app.
type IconProps = { color?: string; size?: number };

const svgProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

const IconBox = ({ color = '#999', size = 20 }: IconProps) => (
  <svg {...svgProps(size)} style={{ color }}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
    <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
  </svg>
);

const IconHierarchy = ({ color = '#999', size = 20 }: IconProps) => (
  <svg {...svgProps(size)} style={{ color }}>
    <path d="M9 3h6v4H9zM3 17h6v4H3zM15 17h6v4h-6zM12 7v4M12 11H6v6M12 11h6v6" />
  </svg>
);

const IconLayout = ({ color = '#999', size = 20 }: IconProps) => (
  <svg {...svgProps(size)} style={{ color }}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M4 10h16M10 10v10" />
  </svg>
);

const IconSettingsAutomation = ({ color = '#999', size = 20 }: IconProps) => (
  <svg {...svgProps(size)} style={{ color }}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" />
  </svg>
);

// A small colored circle with the app initial — replaces twenty-sdk/ui Avatar.
const Avatar = ({ label, size = 64 }: { label: string; size?: number }) => {
  const palette = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  let seed = 0;
  for (let i = 0; i < label.length; i++) seed = (seed + label.charCodeAt(i)) % palette.length;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: palette[seed],
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.42,
        fontWeight: 700,
      }}
    >
      {label.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
};

const CATEGORIES = [
  {
    title: 'Data model',
    color: '#73D08D',
    items: [
      { label: 'CUSTOM OBJECT', href: `${DOCS_BASE_URL}/data/objects` },
      {
        label: 'CUSTOM FIELDS',
        href: `${DOCS_BASE_URL}/data/extending-objects`,
      },
    ],
    rotation: '2.4deg',
  },
  {
    title: 'Logic',
    color: '#F4D345',
    items: [
      {
        label: 'TOOLS',
        href: `${DOCS_BASE_URL}/logic/logic-functions`,
      },
      {
        label: 'LOGIC FUNCTION',
        href: `${DOCS_BASE_URL}/logic/logic-functions`,
      },
      {
        label: 'SKILLS',
        href: `${DOCS_BASE_URL}/logic/skills-and-agents`,
      },
    ],
    rotation: '0deg',
  },
  {
    title: 'Layout',
    color: '#C4A2E0',
    items: [
      { label: 'VIEWS', href: `${DOCS_BASE_URL}/layout/views` },
      { label: 'WIDGETS', href: `${DOCS_BASE_URL}/layout/page-layouts` },
      {
        label: 'LAYOUT PAGES',
        href: `${DOCS_BASE_URL}/layout/page-layouts`,
      },
      {
        label: 'COMMANDS',
        href: `${DOCS_BASE_URL}/layout/command-menu-items`,
      },
    ],
    rotation: '-2.8deg',
  },
] as const;

const ArrowUpRight = ({ color = '#999' }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M4.5 3.5H10.5V9.5M10.5 3.5L3.5 10.5"
      stroke={color}
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CategoryCard = ({
  title,
  color,
  items,
  rotation,
}: {
  title: string;
  color: string;
  items: ReadonlyArray<{ label: string; href: string }>;
  rotation: string;
}) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const CategoryIcon = () => {
    if (title === 'Data model') {
      return <IconHierarchy color={color} size={'20px'} />;
    }
    if (title === 'Logic') {
      return <IconSettingsAutomation color={color} size={'20px'} />;
    }
    if (title === 'Layout') {
      return <IconLayout color={color} size={'20px'} />;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${color}80`,
        borderRadius: '12px',
        overflow: 'hidden',
        width: '240px',
        background: '#FFFFFF',
        transform: `rotate(${rotation})`,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          background: `${color}22`,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <CategoryIcon />
        <span
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: color,
          }}
        >
          {title}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '8px',
          gap: '4px',
        }}
      >
        {items.map((item) => {
          const isHovered = hoveredItem === item.label;

          return (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={() => setHoveredItem(item.label)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                textDecoration: 'none',
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: '8px',
                background: isHovered ? '#0000000A' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <IconBox color={color} size={'20px'} />
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 300,
                  color: '#333',
                  letterSpacing: '0.5px',
                  flex: 1,
                }}
              >
                {item.label}
              </span>
              {isHovered && <ArrowUpRight />}
            </a>
          );
        })}
      </div>
    </div>
  );
};

const MainPage = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        gap: '8px',
        padding: '40px',
      }}
    >
      <Avatar label={APP_DISPLAY_NAME} size={64} />
      <span
        style={{
          fontSize: '24px',
          fontWeight: 600,
          color: '#333',
          marginTop: '8px',
        }}
      >
        {APP_DISPLAY_NAME}
      </span>
      <span
        style={{
          fontSize: '13px',
          color: '#888',
          textAlign: 'center',
          lineHeight: '1.5',
        }}
      >
        Was installed successfully.
        <br />
        You can now add content to your app.
      </span>
      <a
        href="/settings/applications#installed"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '16px',
          fontSize: '13px',
          color: '#333',
          textDecoration: 'none',
          padding: '8px 16px',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          background: '#fafafa',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#f0f0f0';
          e.currentTarget.style.borderColor = '#ccc';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#fafafa';
          e.currentTarget.style.borderColor = '#e0e0e0';
        }}
      >
        Open app settings
        <ArrowUpRight color="#333" />
      </a>
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginTop: '32px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        {CATEGORIES.map((category) => (
          <CategoryCard
            key={category.title}
            title={category.title}
            color={category.color}
            items={category.items}
            rotation={category.rotation}
          />
        ))}
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: APP_DISPLAY_NAME,
  description: `${APP_DISPLAY_NAME} front component displaying the app logo and name`,
  component: MainPage,
});
