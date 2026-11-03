import { describe, expect, it } from "vitest";
import {
  artistNameFromHref,
  buildReleases,
  cleanLabelName,
  cleanLabels,
  decodeEntities,
  decodeLatin1,
  extractDiscogsRef,
  parseLegacyPage,
  parseTitleText,
  slugify,
} from "./legacy-parser.mjs";

const latin1 = (hex: string) => decodeLatin1(Buffer.from(hex, "hex"));

describe("decodeLatin1", () => {
  it("decodes iso-8859-1 umlauts and accents that are invalid UTF-8", () => {
    // "Oöphoi", "Prikosnovénie", "Jäger" as single latin-1 bytes (0xF6, 0xE9, 0xE4).
    expect(decodeLatin1(Buffer.from([0x4f, 0xf6, 0x70, 0x68, 0x6f, 0x69]))).toBe("Oöphoi");
    expect(decodeLatin1(Buffer.from("Prikosnov\xe9nie", "latin1"))).toBe("Prikosnovénie");
    expect(decodeLatin1(Buffer.from("J\xe4ger", "latin1"))).toBe("Jäger");
  });

  it("never produces the UTF-8 replacement character", () => {
    expect(decodeLatin1(Buffer.from([0xf6, 0xe9, 0xe4, 0xb9, 0x01]))).not.toContain("�");
  });
});

describe("decodeEntities", () => {
  it("decodes the named and numeric entities used by the legacy pages", () => {
    expect(decodeEntities("O&ouml;phoi &amp; Tau Ceti")).toBe("Oöphoi & Tau Ceti");
    expect(decodeEntities("1958&#8211;2013")).toBe("1958–2013");
    expect(decodeEntities("a&nbsp;b")).toBe("a b");
  });
});

describe("extractDiscogsRef", () => {
  it("reads master and release ids from clean URLs", () => {
    expect(
      extractDiscogsRef("http://www.discogs.com/O%C3%B6phoi-The-Spirals-Of-Time/master/66159"),
    ).toEqual({ kind: "master", id: 66159 });
    expect(extractDiscogsRef("http://www.discogs.com/Oöphoi-Athlit/release/221375")).toEqual({
      kind: "release",
      id: 221375,
    });
  });

  it("recovers the id when binary junk is inside the host (albums3, Dreams Part Two)", () => {
    const href = latin1(
      "687474703a2f2f77" + // http://w
        "3f3f3f3f3f3f3f3f063f753f3fb93f3f3f3f3f3f3f3f3fb93f3f01" +
        Buffer.from("ww.discogs.com/Oophoi-Dreams-Part-Two/release/971584").toString("hex"),
    );
    expect(extractDiscogsRef(href)).toEqual({ kind: "release", id: 971584 });
  });

  it("recovers the id when binary junk sits between the kind and the id (albums3, EP Collection Vol. 3)", () => {
    const href = latin1(
      Buffer.from("http://www.discogs.com/Klaus-Wiese--Oophoi-EP-Collection-Vol3/release").toString("hex") +
        "3f3f3f3f3f3f3f3f063f753f3fb93f3f3f3f3f3f3f3f3fb93f3f01" +
        Buffer.from("/1126260").toString("hex"),
    );
    expect(extractDiscogsRef(href)).toEqual({ kind: "release", id: 1126260 });
  });

  it("recovers the id when question marks are inside the kind (minis)", () => {
    expect(extractDiscogsRef("http://www.discogs.com/Oophoi-Khumba-Mela/relea??????se/624901")).toEqual({
      kind: "release",
      id: 624901,
    });
    expect(extractDiscogsRef("http://www.discogs.com/Oophoi-Vertigo/rele??????ase/624872")).toEqual({
      kind: "release",
      id: 624872,
    });
  });

  it("recovers the id when the scheme is corrupted (albums4 ht?tp://)", () => {
    expect(extractDiscogsRef("ht?tp://www.discogs.com/Oophoi-Foo/release/4649992")).toEqual({
      kind: "release",
      id: 4649992,
    });
  });

  it("recovers the id from domain-less hrefs", () => {
    expect(extractDiscogsRef("/Aqua-Dorsa-Cloudlands/release/1832427")).toEqual({
      kind: "release",
      id: 1832427,
    });
  });

  it("ignores links that are not releases or masters", () => {
    expect(extractDiscogsRef("http://www.discogs.com/label/Hic+Sunt+Leones")).toBeNull();
    expect(extractDiscogsRef("http://www.discogs.com/artist/Klaus+Wiese")).toBeNull();
    expect(extractDiscogsRef("albums2.html")).toBeNull();
    expect(extractDiscogsRef(undefined)).toBeNull();
  });
});

describe("parseTitleText", () => {
  it("returns a plain title untouched", () => {
    expect(parseTitleText("Athlit")).toEqual({ title: "Athlit", with: [] });
  });

  it("extracts the version count in its different legacy spellings", () => {
    expect(parseTitleText("The Spirals Of Time - (3 versions)")).toMatchObject({
      title: "The Spirals Of Time",
      versions: 3,
    });
    expect(parseTitleText("Time Fragments Vol. 1 - The Archives 1995/1997 (5 versions)")).toMatchObject({
      title: "Time Fragments Vol. 1 - The Archives 1995/1997",
      versions: 5,
    });
    expect(parseTitleText("Ruh (Album) (2 versions)")).toMatchObject({ title: "Ruh", versions: 2, format: "Album" });
  });

  it("keeps dashes and commas that belong to the title", () => {
    expect(parseTitleText("Dust In The Wind - The Works, 1995 - 2003 - (2 versions)")).toMatchObject({
      title: "Dust In The Wind - The Works, 1995 - 2003",
      versions: 2,
    });
  });

  it("extracts collaborators joined by commas and ampersands", () => {
    expect(parseTitleText("Wouivre (with Klaus Wiese) - (2 versions)")).toEqual({
      title: "Wouivre",
      with: ["Klaus Wiese"],
      versions: 2,
    });
    expect(parseTitleText("Upuaut (with Mathias Grassow & Amir Baghiri) - (4 versions)")).toMatchObject({
      with: ["Mathias Grassow", "Amir Baghiri"],
    });
    expect(parseTitleText("EP Collection Vol.4 (with L.E.M. )")).toMatchObject({ with: ["L.E.M."] });
  });

  it("extracts an alias with or without collaborators", () => {
    expect(parseTitleText("Genesis (as Nebula with Klaus Wiese, Mathias Grassow, Tau Ceti)")).toEqual({
      title: "Genesis",
      alias: "Nebula",
      with: ["Klaus Wiese", "Mathias Grassow", "Tau Ceti"],
    });
    expect(parseTitleText("La Camera Obscura ( as Liquid Ghosts with Netherworld & Tau Ceti)")).toEqual({
      title: "La Camera Obscura",
      alias: "Liquid Ghosts",
      with: ["Netherworld", "Tau Ceti"],
    });
    expect(parseTitleText("Something (as Aqua Dorsa)")).toEqual({ title: "Something", alias: "Aqua Dorsa", with: [] });
  });

  it("extracts the format next to a collaborator", () => {
    expect(parseTitleText("Le Torri Del Silenzio (with Tau Ceti) (CDr, EP)")).toEqual({
      title: "Le Torri Del Silenzio",
      with: ["Tau Ceti"],
      format: "CDr, EP",
    });
    expect(parseTitleText('Potala (10", Ltd, Cle/Minialbum)')).toMatchObject({ format: '10", Ltd, Cle/Minialbum' });
    expect(parseTitleText("Dreams (7xCDr, Mini, Ltd)")).toMatchObject({ format: "7xCDr, Mini, Ltd" });
    expect(
      parseTitleText("Creation - Chinese Gong (CDr, Album, RE, RM) (with Bernhard Jäger)"),
    ).toEqual({ title: "Creation - Chinese Gong", with: ["Bernhard Jäger"], format: "CDr, Album, RE, RM" });
  });

  it("treats a box description as the format, not as collaborators", () => {
    expect(parseTitleText("Time Fragments: The Complete Series (Limited Edition Box with 7xCDr)")).toEqual({
      title: "Time Fragments: The Complete Series",
      with: [],
      format: "Limited Edition Box with 7xCDr",
    });
  });

  it("keeps unknown parentheticals as a note", () => {
    expect(parseTitleText("Meditation (compilation, mostly Mare Vaporum)")).toEqual({
      title: "Meditation",
      with: [],
      note: "Compilation, mostly Mare Vaporum",
    });
  });
});

describe("label cleaning", () => {
  it("removes trailing commas, extra whitespace and Discogs disambiguators", () => {
    expect(cleanLabelName("Glacial \r\n Movements Records,")).toBe("Glacial Movements Records");
    expect(cleanLabelName("Harmonie (2)")).toBe("Harmonie");
    expect(cleanLabelName("Cue Records (Germany)")).toBe("Cue Records (Germany)");
    expect(cleanLabelName(" , ")).toBeNull();
  });

  it("deduplicates repeated labels and prefers the canonical name from the href", () => {
    expect(
      cleanLabels([
        { text: "Aurora", href: "http://www.discogs.com/label/Aurora" },
        { text: "Aurora", href: "http://www.discogs.com/label/Aurora" },
      ]),
    ).toEqual([{ name: "Aurora", discogsUrl: "https://www.discogs.com/label/Aurora" }]);
    expect(cleanLabels([{ text: "Harmonie", href: "http://www.discogs.com/label/Harmonie+(2)" }])).toEqual([
      { name: "Harmonie", discogsUrl: "https://www.discogs.com/label/Harmonie+(2)" },
    ]);
    expect(
      cleanLabels([{ text: "Glacial Movements ", href: "http://www.discogs.com/label/Glacial+Movements+Records" }]),
    ).toEqual([
      { name: "Glacial Movements Records", discogsUrl: "https://www.discogs.com/label/Glacial+Movements+Records" },
    ]);
    expect(cleanLabels([{ text: "Prikosnovénie", href: "http://www.discogs.com/label/Prikosnov%C3%A9nie" }])).toEqual([
      { name: "Prikosnovénie", discogsUrl: "https://www.discogs.com/label/Prikosnov%C3%A9nie" },
    ]);
  });

  it("splits comma-separated plain text labels", () => {
    expect(cleanLabels([{ text: "Aurora, Aurora" }])).toEqual([{ name: "Aurora" }]);
  });

  it("repairs corrupted label hrefs", () => {
    expect(cleanLabels([{ text: "Practising Nature", href: "ht?tp://www.discogs.com/label/Practising+Nature" }])).toEqual(
      [{ name: "Practising Nature", discogsUrl: "https://www.discogs.com/label/Practising+Nature" }],
    );
    expect(cleanLabels([{ text: "Penumbra", href: "http://w??????ww.discogs.com/label/Penumbra" }])).toEqual([
      { name: "Penumbra", discogsUrl: "https://www.discogs.com/label/Penumbra" },
    ]);
  });
});

describe("artistNameFromHref", () => {
  it("decodes canonical artist names", () => {
    expect(artistNameFromHref("http://www.discogs.com/artist/Nebula+(4)")).toBe("Nebula");
    expect(artistNameFromHref("http://www.discogs.com/artist/Bernhard+J%C3%A4ger")).toBe("Bernhard Jäger");
    expect(artistNameFromHref("http://www.discogs.com/artist/Louisa+John-Krol?anv=Louisa+John+Krol")).toBe(
      "Louisa John-Krol",
    );
    expect(artistNameFromHref("http://www.discogs.com/label/Umbra")).toBeNull();
  });
});

describe("slugify", () => {
  it("creates URL-safe ASCII slugs", () => {
    expect(slugify("Static Soundscapes: Three Lights At The End Of The World")).toBe(
      "static-soundscapes-three-lights-at-the-end-of-the-world",
    );
    expect(slugify("Time Fragments Vol. 1 - The Archives 1995/1997")).toBe(
      "time-fragments-vol-1-the-archives-1995-1997",
    );
    expect(slugify("A Call, An Echo")).toBe("a-call-an-echo");
    expect(slugify("Prikosnovénie")).toBe("prikosnovenie");
  });
});

const albumRow = `
<tr>
  <td width="54"> <a href="http://www.discogs.com/Nebula-The-Path-Of-White-Clouds/master/331461">
    <img src="thumbs/R-90-740659-1203717243.jpeg"> </a> </td>
  <td> <p><a href="http://www.discogs.com/Nebula-The-Path-Of-White-Clouds/master/331461">The
      Path Of White Clouds</a> (as <a href="http://www.discogs.com/artist/Nebula+(4)">Nebula</a>
      with <a href="http://www.discogs.com/artist/Klaus+Wiese">K. Wiese</a>,
      <a href="http://www.discogs.com/artist/Mathias+Grassow">M. Grassow</a>,
      <a href="http://www.discogs.com/artist/Tau+Ceti">Tau Ceti</a>) <br/>
      (2 versions) </p></td>
  <td><a href="http://www.discogs.com/label/Stella+Maris">Stella Maris</a></td>
  <td> <p>2003 </p></td>
</tr>`;

describe("parseLegacyPage", () => {
  it("parses an album row with alias, canonical collaborator names, versions, label, year and thumb", () => {
    const { rows, unparsed } = parseLegacyPage(`<table>${albumRow}</table>`, { file: "albums2.html", layout: "release" });
    expect(unparsed).toEqual([]);
    expect(rows).toEqual([
      {
        source: "albums2.html",
        title: "The Path Of White Clouds",
        year: 2003,
        labels: [{ name: "Stella Maris", discogsUrl: "https://www.discogs.com/label/Stella+Maris" }],
        credit: { alias: "Nebula", with: ["Klaus Wiese", "Mathias Grassow", "Tau Ceti"] },
        discogs: { kind: "master", id: 331461, versions: 2 },
        thumb: "thumbs/R-90-740659-1203717243.jpeg",
        linkedRefs: [],
        hidden: false,
      },
    ]);
  });

  it("skips pagination, spacer and note rows without reporting them", () => {
    const html = `<table>
      <tr align="center"><td colspan="4"><p>Pages: <a href="albums2.html">2</a></p></td></tr>
      <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
      <tr valign="middle"><td colspan="4"><p><strong>Note</strong>: see <a href="albums1.html">Albums</a></p></td></tr>
    </table>`;
    expect(parseLegacyPage(html, { file: "minis.html", layout: "release" })).toEqual({ rows: [], unparsed: [] });
  });

  it("reports release-like rows it cannot parse", () => {
    const html = `<table><tr><td><img src="thumbs/x.jpeg"></td><td><p>Mystery</p></td><td></td><td>n/a</td></tr></table>`;
    const { rows, unparsed } = parseLegacyPage(html, { file: "albums1.html", layout: "release" });
    expect(rows).toEqual([]);
    expect(unparsed).toHaveLength(1);
    expect(unparsed[0]).toMatchObject({ source: "albums1.html" });
    expect(unparsed[0].reason).toMatch(/discogs/i);
  });

  it("parses Klaus Wiese rows, including rows hidden with display:none", () => {
    const html = `<table>
      <tr> <th colspan="3"><p>Releases:</p></th> </tr>
      <tr> <td width="80"><p>KW 001</p></td>
        <td width="570"><p><a href="http://www.discogs.com/Klaus-Wiese-Ruh/master/514347">Ruh</a> (Album) <a> (2 versions)</a></p></td>
        <td width="50"><p>2004</p></td> </tr>
      <tr style="display:none"> <td><p>KW 001</p></td>
        <td><p><a href="http://www.discogs.com/Klaus-Wiese-Ruh/release/925627">Ruh</a> (CDr, Album)</p></td>
        <td><p>2004</p></td> </tr>
    </table>`;
    const { rows } = parseLegacyPage(html, { file: "klauswiese.html", layout: "kw" });
    expect(rows).toMatchObject([
      { catalogNo: "KW 001", title: "Ruh", format: "Album", discogs: { kind: "master", id: 514347, versions: 2 }, hidden: false },
      { catalogNo: "KW 001", title: "Ruh", format: "CDr, Album", discogs: { kind: "release", id: 925627 }, hidden: true },
    ]);
  });

  it("parses compilation rows with label, year, format, tracks and the following note row", () => {
    const html = `<table>
      <tr> <td colspan="2"> <h1>Album</h1></td> <td colspan="2"> <h1>Tracks</h1></td> </tr>
      <tr> <td width="60"> <a href="http://www.discogs.com/Various-Lightnoise/release/460616"> <img src="thumbs/R-90-460616-1182390486.jpeg"> </a> </td>
        <td> <p><a href="http://www.discogs.com/Various-Lightnoise/release/460616">Lightnoise</a> <br> <a href="http://www.discogs.com/label/Umbra">Umbra</a> 2005 (2xCDr) </p></td>
        <td> <p> <strong>Eclipse In The Fourth System</strong> (with Tau Ceti)<br> <strong>Quantum Light</strong> (with Klaus Wiese) </p></td>
        <td> <p>21:44<br> 13:25</p></td> </tr>
      <tr> <td colspan="2" class="divider">&nbsp;</td> <td colspan="2" class="divider"> <p>- Both tracks Included in <a href="http://www.discogs.com/Oophoi-Whispers-From-The-Noisy-Void/master/210933" target="_blank">Whispers from the Noisy Void</a> (2007)</p></td> </tr>
    </table>`;
    const { rows, unparsed } = parseLegacyPage(html, { file: "compilations.html", layout: "compilation" });
    expect(unparsed).toEqual([]);
    expect(rows).toEqual([
      {
        source: "compilations.html",
        title: "Lightnoise",
        year: 2005,
        format: "2xCDr",
        labels: [{ name: "Umbra", discogsUrl: "https://www.discogs.com/label/Umbra" }],
        credit: { with: [] },
        discogs: { kind: "release", id: 460616 },
        thumb: "thumbs/R-90-460616-1182390486.jpeg",
        tracks: [
          { title: "Eclipse In The Fourth System", duration: "21:44", with: ["Tau Ceti"] },
          { title: "Quantum Light", duration: "13:25", with: ["Klaus Wiese"] },
        ],
        note: "Both tracks Included in Whispers from the Noisy Void (2007)",
        linkedRefs: [{ kind: "master", id: 210933 }],
        hidden: false,
      },
    ]);
  });
});

describe("buildReleases", () => {
  const row = (overrides: Record<string, unknown>) => ({
    source: "albums1.html",
    title: "Dreams",
    year: 2004,
    labels: [],
    credit: { with: [] },
    discogs: { kind: "release", id: 1 },
    linkedRefs: [],
    hidden: false,
    ...overrides,
  });

  it("maps sources and formats to release types", () => {
    const releases = buildReleases([
      row({ source: "albums1.html", title: "A" }),
      row({ source: "albums4.html", title: "B", format: "Limited Edition Box with 7xCDr", discogs: { kind: "release", id: 2 } }),
      row({ source: "minis.html", title: "C", format: "CDr, EP", discogs: { kind: "release", id: 3 } }),
      row({ source: "minis.html", title: "D", format: '10", Ltd, Cle/Minialbum', discogs: { kind: "release", id: 4 } }),
      row({ source: "compilations.html", title: "E", discogs: { kind: "release", id: 5 } }),
      row({ source: "klauswiese.html", title: "F", catalogNo: "KW 001", discogs: { kind: "release", id: 6 } }),
    ]);
    expect(releases.map((r: { type: string }) => r.type)).toEqual([
      "album",
      "box",
      "ep",
      "minialbum",
      "compilation-appearance",
      "kw-remaster",
    ]);
    expect(releases[5]).toMatchObject({ artist: "Klaus Wiese" });
  });

  it("gives every release a unique, deterministic slug", () => {
    const input = [
      row({ title: "Ruh", discogs: { kind: "master", id: 10 } }),
      row({ title: "Ruh", discogs: { kind: "release", id: 11 } }),
      row({ title: "Ruh", year: 2005, discogs: { kind: "release", id: 12 } }),
    ];
    input.push(row({ title: "Ruh", year: 2006, hidden: true, discogs: { kind: "release", id: 13 } }));
    const slugs = buildReleases(input).map((r: { slug: string }) => r.slug);
    // Hidden versions are always told apart by their Discogs id.
    expect(slugs).toEqual(["ruh", "ruh-11", "ruh-2005", "ruh-13"]);
    expect(buildReleases(input).map((r: { slug: string }) => r.slug)).toEqual(slugs);
  });

  it("resolves linked Discogs references and hidden KW versions to related slugs", () => {
    const releases = buildReleases([
      row({ title: "Mare Vaporum", discogs: { kind: "master", id: 104494 } }),
      row({ title: "Meditation", discogs: { kind: "release", id: 772334 }, linkedRefs: [{ kind: "master", id: 104494 }] }),
      row({ source: "klauswiese.html", title: "Ruh", catalogNo: "KW 001", discogs: { kind: "master", id: 514347 } }),
      row({ source: "klauswiese.html", title: "Ruh", catalogNo: "KW 001", hidden: true, discogs: { kind: "release", id: 925627 } }),
    ]);
    expect(releases[1].relatedTo).toEqual(["mare-vaporum"]);
    expect(releases[3]).toMatchObject({ hidden: true, relatedTo: ["ruh"] });
    expect(releases[0].relatedTo).toBeUndefined();
  });
});
