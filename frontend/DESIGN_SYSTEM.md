# VanlifeVibes Design System

A dark-mode-first design system inspired by Instagram, optimized for mobile and built with Tailwind CSS v4.

## Design Philosophy

- **Mobile-first**: Design for phones, enhance for tablets/desktop
- **Dark mode native**: True black backgrounds for OLED screens
- **Minimal & clean**: Let content (photos, profiles) be the focus
- **Consistent spacing**: 4px base unit system
- **Accessible**: WCAG AA contrast ratios

---

## Color Palette

### Background Colors
```
bg-black        #000000   - Primary background (true black for OLED)
bg-zinc-900     #18181b   - Elevated surfaces (cards, modals)
bg-zinc-800     #27272a   - Secondary surfaces (inputs, hover states)
bg-zinc-700     #3f3f46   - Tertiary (borders, dividers)
```

### Text Colors
```
text-white      #ffffff   - Primary text
text-zinc-300   #d4d4d8   - Secondary text
text-zinc-500   #71717a   - Muted/placeholder text
```

### Accent Colors
```
text-blue-500   #3b82f6   - Primary action (links, buttons)
text-blue-400   #60a5fa   - Primary hover
bg-blue-500     #3b82f6   - Primary button background
bg-blue-600     #2563eb   - Primary button hover

text-rose-500   #f43f5e   - Like/heart actions
text-emerald-500 #10b981  - Success states
text-amber-500  #f59e0b   - Warning states
text-red-500    #ef4444   - Error states
```

### Gradient (Brand accent - use sparingly)
```css
bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500
```

---

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

### Scale (Mobile-first)
```
text-xs     12px   - Timestamps, badges
text-sm     14px   - Secondary text, captions
text-base   16px   - Body text (default)
text-lg     18px   - Subheadings
text-xl     20px   - Section titles
text-2xl    24px   - Page titles
```

### Font Weights
```
font-normal   400   - Body text
font-medium   500   - Emphasis
font-semibold 600   - Headings, names
font-bold     700   - Strong emphasis (rare)
```

---

## Spacing System

Based on 4px increments:
```
0.5   2px    - Micro spacing
1     4px    - Tight spacing
2     8px    - Default gap
3     12px   - Component padding
4     16px   - Section spacing
5     20px   - Large gaps
6     24px   - Section margins
8     32px   - Page padding
```

---

## Border Radius

```
rounded-none    0      - Sharp edges (rare)
rounded         4px    - Subtle rounding
rounded-md      6px    - Buttons, inputs
rounded-lg      8px    - Cards
rounded-xl      12px   - Large cards, modals
rounded-full    9999px - Avatars, pills
```

---

## Components

### Avatar Sizes
```
w-6 h-6     24px   - Inline mentions
w-8 h-8     32px   - Comment avatars
w-10 h-10   40px   - List items
w-12 h-12   48px   - Feed cards
w-16 h-16   64px   - Profile headers
w-20 h-20   80px   - Large profile view
w-32 h-32   128px  - Profile page hero
```

### Avatar Component
```jsx
// Small (comments, lists)
<img className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-700" />

// Medium (feed cards)
<img className="w-12 h-12 rounded-full object-cover ring-2 ring-zinc-700" />

// Large (profile page)
<img className="w-20 h-20 rounded-full object-cover ring-2 ring-zinc-700" />

// With gradient ring (stories-style)
<div className="p-0.5 rounded-full bg-gradient-to-tr from-amber-500 to-pink-500">
  <img className="w-12 h-12 rounded-full object-cover ring-2 ring-black" />
</div>
```

### Buttons

#### Primary Button
```jsx
<button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors">
  Follow
</button>
```

#### Secondary Button (Outline)
```jsx
<button className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-white text-sm font-semibold rounded-lg transition-colors">
  Message
</button>
```

#### Ghost Button
```jsx
<button className="px-4 py-2 hover:bg-zinc-800 text-zinc-300 text-sm font-medium rounded-lg transition-colors">
  Cancel
</button>
```

#### Icon Button
```jsx
<button className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
  <HeartIcon className="w-6 h-6 text-white" />
</button>
```

### Cards

#### Feed Card (Grid item)
```jsx
<div className="flex flex-col items-center p-3 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer">
  <img className="w-16 h-16 rounded-full object-cover ring-2 ring-zinc-700 mb-2" />
  <span className="text-sm font-semibold text-white truncate max-w-full">Display Name</span>
  <span className="text-xs text-zinc-500">Here Now</span>
</div>
```

#### List Card (Horizontal)
```jsx
<div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer">
  <img className="w-12 h-12 rounded-full object-cover" />
  <div className="flex-1 min-w-0">
    <p className="text-sm font-semibold text-white truncate">Display Name</p>
    <p className="text-xs text-zinc-500">@username</p>
  </div>
  <button className="px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-lg">
    Follow
  </button>
</div>
```

### Input Fields

#### Text Input
```jsx
<input 
  type="text"
  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors"
  placeholder="Search..."
/>
```

#### Textarea
```jsx
<textarea 
  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none"
  rows={3}
  placeholder="Write a caption..."
/>
```

### Navigation

#### Bottom Tab Bar (Mobile)
```jsx
<nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-800 px-4 py-2 safe-area-pb">
  <div className="flex justify-around items-center max-w-lg mx-auto">
    <NavItem icon={HomeIcon} active />
    <NavItem icon={SearchIcon} />
    <NavItem icon={PlusSquareIcon} />
    <NavItem icon={HeartIcon} />
    <NavItem icon={UserIcon} />
  </div>
</nav>
```

#### Top Header
```jsx
<header className="sticky top-0 z-50 bg-black/95 backdrop-blur border-b border-zinc-800">
  <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
    <h1 className="text-xl font-semibold text-white">VanlifeVibes</h1>
    <div className="flex items-center gap-2">
      <IconButton icon={HeartIcon} />
      <IconButton icon={MessageIcon} />
    </div>
  </div>
</header>
```

### Badges & Pills

#### Status Badge
```jsx
<span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full">
  Here Now
</span>
```

#### Count Badge
```jsx
<span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
  3
</span>
```

#### Tag/Chip
```jsx
<span className="px-3 py-1 bg-zinc-800 text-zinc-300 text-sm rounded-full">
  #vanlife
</span>
```

---

## Layout Patterns

### Page Container
```jsx
<div className="min-h-screen bg-black">
  <Header />
  <main className="max-w-lg mx-auto px-4 pb-20">
    {/* Content */}
  </main>
  <BottomNav />
</div>
```

### Feed Grid (2 columns mobile, 3 on tablet)
```jsx
<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
  {items.map(item => <FeedCard key={item.id} {...item} />)}
</div>
```

### Section with Title
```jsx
<section className="space-y-3">
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-semibold text-white">Here Now</h2>
    <span className="text-xs text-zinc-500">12 people</span>
  </div>
  <div className="grid grid-cols-2 gap-3">
    {/* Cards */}
  </div>
</section>
```

---

## States

### Loading
```jsx
// Spinner
<div className="w-6 h-6 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin" />

// Skeleton
<div className="w-full h-12 bg-zinc-800 rounded-lg animate-pulse" />
```

### Empty State
```jsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="w-16 h-16 mb-4 text-zinc-600">
    <EmptyIcon />
  </div>
  <h3 className="text-lg font-semibold text-white mb-1">No travelers nearby</h3>
  <p className="text-sm text-zinc-500 max-w-xs">
    Set your location to discover other van lifers in your area.
  </p>
  <button className="mt-4 px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg">
    Set Location
  </button>
</div>
```

### Error State
```jsx
<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
  <p className="text-sm text-red-400">Something went wrong. Please try again.</p>
</div>
```

---

## Responsive Breakpoints

```
sm:   640px   - Large phones / small tablets
md:   768px   - Tablets
lg:   1024px  - Desktop
xl:   1280px  - Large desktop
```

### Mobile-first approach
```jsx
// Default: mobile styles
// sm: tablet enhancements
// lg: desktop enhancements

<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
```

---

## Animation & Transitions

### Standard Transition
```jsx
className="transition-colors duration-200"
className="transition-all duration-200"
```

### Hover Effects
```jsx
// Subtle lift
className="hover:-translate-y-0.5 transition-transform"

// Background change
className="hover:bg-zinc-800 transition-colors"

// Border highlight
className="border border-zinc-800 hover:border-zinc-600 transition-colors"
```

---

## Accessibility

- All interactive elements must have visible focus states
- Use `focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black`
- Maintain 4.5:1 contrast ratio for text
- Use semantic HTML elements
- Include aria-labels for icon-only buttons

---

## File Organization

```
frontend/src/
├── index.css              # Tailwind imports + custom utilities
├── components/
│   ├── ui/                # Primitive components
│   │   ├── Avatar.jsx
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Input.jsx
│   │   └── Badge.jsx
│   ├── layout/            # Layout components
│   │   ├── Header.jsx
│   │   ├── BottomNav.jsx
│   │   └── PageContainer.jsx
│   └── [feature]/         # Feature-specific components
│       └── FeedCard.jsx
└── pages/
    └── [PageName].jsx     # Page components (no CSS files needed)
```

---

## Migration Checklist

When converting a component to Tailwind:

1. [ ] Remove the `.css` file import
2. [ ] Delete the `.css` file
3. [ ] Replace class names with Tailwind utilities
4. [ ] Use design system tokens (colors, spacing, etc.)
5. [ ] Test responsive behavior
6. [ ] Verify dark mode appearance
7. [ ] Check accessibility (focus states, contrast)
