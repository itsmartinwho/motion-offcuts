"use client";

import { useState, type CSSProperties, type ElementType, type FocusEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DOCK_GLYPHS, DockGlyphDefs } from "./DockGlyphs";
import { GlassLayers } from "./GlassLayers";
import { LINE_GLYPHS } from "./LineGlyphs";
import type { DockGroup, DockItem, GroundName } from "./types";
import { useFolder } from "./useFolder";
import styles from "./Hero.module.css";

/* The dock: groups of links on glass, divided by thin separators. Hovering
   (or keyboard-focusing) a tile magnifies it and, a step less, its two
   neighbours — transform only, eased in CSS from the `data-d` distance this
   writes — names it above, and sets a glyph tile moving (DockGlyphs). On a
   phone (and on any touch screen) there is no magnification and no names:
   aria-label carries what they are. A group with a `folder` name is one
   folder on a phone (DockFolder), so the bar carries fewer tiles; the
   folder is phone-only and the group's tiles desktop-only, both by CSS, so
   the first paint is already right. */

const GROUND: Record<GroundName, string> = {
  ultramarine: styles.groundUltramarine,
  violet: styles.groundViolet,
  magenta: styles.groundMagenta,
  coral: styles.groundCoral,
};

/** The grounds glyph tiles take in turn when they name none. */
const GROUND_RUN: readonly GroundName[] = ["ultramarine", "violet", "magenta", "coral"];

type Row =
  | { kind: "item"; item: DockItem; key: string; end: boolean; folded: boolean; desk: number; ground: GroundName }
  | { kind: "folder"; group: DockGroup; key: string; end: boolean; grounds: GroundName[] };

/** The dock's rows: each group's items, and after a folded group's items its
    folder. An entry closes its group (a separator after it) if it is the
    last of the group in its row: a folded group's items are never in the
    same row as its folder, so its last item closes the desktop's group and
    the folder a phone's. */
function rows(groups: DockGroup[]): Row[] {
  const out: Row[] = [];
  let desk = 0;
  let glyphs = 0;
  groups.forEach((group, g) => {
    const last = g === groups.length - 1;
    const grounds: GroundName[] = [];
    group.items.forEach((item, i) => {
      const ground = "glyph" in item.icon ? (item.icon.ground ?? GROUND_RUN[glyphs++ % GROUND_RUN.length]) : "ultramarine";
      grounds.push(ground);
      out.push({
        kind: "item",
        item,
        key: `${g}-${i}-${item.label}`,
        end: !last && i === group.items.length - 1,
        folded: Boolean(group.folder),
        desk: desk++,
        ground,
      });
    });
    if (group.folder) out.push({ kind: "folder", group, key: `${g}-folder`, end: !last, grounds });
  });
  return out;
}

function TileFace({ item, ground }: { item: DockItem; ground: GroundName }) {
  const { icon } = item;
  if ("glyph" in icon) {
    const Glyph = DOCK_GLYPHS[icon.glyph];
    return (
      <span className={`${styles.tile} ${styles.tilePage} ${GROUND[ground]}`}>
        <Glyph className={styles.glyph} />
      </span>
    );
  }
  if ("line" in icon) {
    const Glyph = LINE_GLYPHS[icon.line];
    return (
      <span className={`${styles.tile} ${styles.tileLine}`} style={{ color: icon.color }}>
        <Glyph className={styles.lineGlyph} />
      </span>
    );
  }
  if ("image" in icon) {
    return (
      <span className={`${styles.tile} ${styles.tileImage} ${icon.round ? styles.tileRound : ""}`}>
        <img src={icon.image} alt="" decoding="async" />
      </span>
    );
  }
  const style = { "--tile-bg": icon.background, "--tile-ink": icon.color } as CSSProperties;
  return (
    <span className={`${styles.tile} ${styles.tileMark} ${icon.round ? styles.tileRound : ""}`} style={style}>
      {icon.node}
    </span>
  );
}

/** A link to an item: in a new tab if it is external, through the host's
    link component otherwise. */
function ItemLink({
  item,
  linkComponent: LinkTag,
  className,
  ...rest
}: {
  item: DockItem;
  linkComponent: ElementType;
  className: string;
  children: ReactNode;
  onFocus?: (e: FocusEvent<HTMLElement>) => void;
  onBlur?: () => void;
  "aria-label"?: string;
}) {
  if (item.external) {
    return <a {...rest} className={className} href={item.href} target="_blank" rel="noopener noreferrer" />;
  }
  return <LinkTag {...rest} className={className} href={item.href} />;
}

const itemLabel = (item: DockItem) => (item.external ? `${item.label} (opens in a new tab)` : item.label);

/* A phone's folder for one group, iOS's way (useFolder): the tile is a
   frosted squircle holding the group's tiles small; tapped, a frosted panel
   grows out of it over the hero, with them at full size and named. */
function DockFolder({ group, grounds, linkComponent }: { group: DockGroup; grounds: GroundName[]; linkComponent: ElementType }) {
  const { tileRef, panelRef, phase, hero, id, open, toggle, close, trap, tapTile } = useFolder();
  const name = group.folder ?? "";
  return (
    <>
      <button
        ref={tileRef}
        type="button"
        className={`${styles.dockLink} ${styles.folderButton}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={name}
        onClick={toggle}
      >
        <span className={`${styles.tile} ${styles.tileFolder}`}>
          <span className={styles.tileFolderMini} aria-hidden="true">
            {group.items.slice(0, 4).map((item, i) => (
              <TileFace key={item.label} item={item} ground={grounds[i]} />
            ))}
          </span>
        </span>
      </button>

      {phase !== "closed" &&
        hero &&
        createPortal(
          <div className={styles.folderLayer} data-phase={phase}>
            <button type="button" className={styles.folderScrim} tabIndex={-1} aria-label="Close" onClick={close} />
            <div
              ref={panelRef}
              id={id}
              role="dialog"
              aria-modal="true"
              aria-label={name}
              tabIndex={-1}
              className={styles.folderPanel}
              onKeyDown={trap}
              onClick={tapTile}
            >
              <div className={styles.folderGlass} aria-hidden="true">
                <GlassLayers />
              </div>
              <p className={styles.folderLabel}>{name}</p>
              <ul className={`${styles.folderGrid} ${styles.groupGrid}`}>
                {group.items.map((item, i) => (
                  <li key={item.label}>
                    <ItemLink item={item} linkComponent={linkComponent} className={styles.fileLink} aria-label={itemLabel(item)}>
                      <TileFace item={item} ground={grounds[i]} />
                      <span className={styles.caption}>{item.label}</span>
                    </ItemLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          hero,
        )}
    </>
  );
}

export function HeroDock({ groups, linkComponent = "a" }: { groups: DockGroup[]; linkComponent?: ElementType }) {
  const [active, setActive] = useState(-1);
  const list = rows(groups);
  // A phone's tiles: the unfolded groups' items and one per folder.
  const phoneSlots = groups.reduce((n, group) => n + (group.folder ? 1 : group.items.length), 0);

  const focused = (i: number) => (e: FocusEvent<HTMLElement>) => {
    // Only the keyboard: a click leaves focus behind on a link that opens a
    // new tab, and the tile would stay magnified.
    if (e.currentTarget.matches(":focus-visible")) setActive(i);
  };

  return (
    <nav className={styles.dock} aria-label="Links" style={{ "--phone-slots": phoneSlots } as CSSProperties}>
      <DockGlyphDefs />
      <div className={styles.dockGlass} aria-hidden="true">
        <GlassLayers />
      </div>
      <ul className={styles.dockRow} onPointerLeave={() => setActive(-1)}>
        {list.map((row) => {
          if (row.kind === "folder") {
            return (
              <li key={row.key} className={styles.slot} data-end={row.end ? "true" : undefined} data-only="phone">
                <DockFolder group={row.group} grounds={row.grounds} linkComponent={linkComponent} />
              </li>
            );
          }
          const { item, desk } = row;
          const d = active < 0 ? undefined : Math.abs(desk - active);
          return (
            <li
              key={row.key}
              className={styles.slot}
              data-end={row.end ? "true" : undefined}
              data-only={row.folded ? "desk" : undefined}
              data-d={d !== undefined && d <= 1 ? d : undefined}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse" || e.pointerType === "pen") setActive(desk);
              }}
            >
              <ItemLink
                item={item}
                linkComponent={linkComponent}
                className={styles.dockLink}
                aria-label={itemLabel(item)}
                onFocus={focused(desk)}
                onBlur={() => setActive(-1)}
              >
                <TileFace item={item} ground={row.ground} />
              </ItemLink>
              <span className={styles.tip} aria-hidden="true">
                {item.label}
              </span>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
