---
version: alpha
name: "Daigow"
description: "Seller workspace with compact commerce tables and a quiet green identity."
colors:
  canvas: "#f3f3f0"
  brand: "#173f3b"
  brand-hover: "#0f2f2b"
  ink: "#1f2a28"
  muted: "#7a7d76"
  field: "#e4e4df"
  border: "#e6e6e1"
typography:
  sans:
    fontFamily: "Google Sans Flex, ui-sans-serif, system-ui, sans-serif"
rounded:
  DEFAULT: "0.375rem"
  sm: "0.25rem"
  lg: "0.5rem"
components:
  button: {}
  table: {}
  field: {}
---

# Daigow design context

## Direction

The seller workspace follows the supplied product-list reference: a pale neutral canvas, white content surfaces, fine dividers, compact rows, and deep green primary actions. The audience is Indonesian jastip sellers managing trips, products, and orders, often on a phone. Product screens favor clear information and quick scanning over decoration.

## Runtime ownership

`app/assets/css/main.css` owns the shared Tailwind color and font tokens listed above. This document records the current visual direction; it does not generate CSS. The product-list page uses a slightly lighter local surface (`#fafaf9`) to match the supplied reference without changing the existing app theme.

## Components

- Buttons use deep green for the primary page action, neutral outlines for secondary actions, and red only for destructive actions.
- Tables use white backgrounds, subtle borders, uppercase compact headers, small product images, and visible hover and keyboard-focus states.
- Fields keep native select behavior and use the shared border and text colors.
- Product forms use a 30px desktop title, 18px section titles, 16px input text, 13px labels, and controls at least 48px tall. Create and edit forms share a centered content column that scales from about 592px on laptops to 832px on wide screens; long forms retain natural page scrolling.
- Seller order details use the same responsive content column and type scale. Status badges describe lifecycle state; actions appear only when the seller can perform them. Payment and payout amounts use order snapshots, with cancelled items excluded from seller payout estimates.
- The public Trip page uses a compact navigation bar, a full-width trip-cover hero with a dark green scrim, and a two-column catalog with filters beside product cards on desktop. On mobile, controls stack above the cards. Product titles and prices use at least 16px type; captions and filter labels remain smaller. Coming-soon Trips show an email subscription form, while open and closed Trips show the catalog. The buyer catalog uses actual product categories for filters because products do not store a shop name.
- Money is formatted in `id-ID` with whole rupiah. Interface copy is in Bahasa Indonesia.
- On narrow screens, tabular content may scroll horizontally so labels, prices, and actions remain readable.
