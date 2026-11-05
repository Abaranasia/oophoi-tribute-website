import { describe, expect, it } from "vitest";
import { creditLine, relatedSlugs, releaseDescription } from "./release-format";
import { RELEASE_TYPE_LABELS } from "./release-types";

describe("creditLine", () => {
  it("credits Oöphoi alone when there are no collaborators", () => {
    expect(creditLine({ artist: "Oöphoi", credit: { with: [] } })).toBe("Oöphoi");
  });

  it("lists collaborators with commas and a final ampersand", () => {
    expect(creditLine({ artist: "Oöphoi", credit: { with: ["Klaus Wiese"] } })).toBe("Oöphoi with Klaus Wiese");
    expect(
      creditLine({ artist: "Oöphoi", credit: { with: ["Mathias Grassow", "Amir Baghiri", "Tau Ceti"] } }),
    ).toBe("Oöphoi with Mathias Grassow, Amir Baghiri & Tau Ceti");
  });

  it("puts an alias first", () => {
    expect(creditLine({ artist: "Oöphoi", credit: { alias: "Nebula", with: ["Klaus Wiese", "Tau Ceti"] } })).toBe(
      "As Nebula, with Klaus Wiese & Tau Ceti",
    );
    expect(creditLine({ artist: "Oöphoi", credit: { alias: "Aqua Dorsa", with: [] } })).toBe("As Aqua Dorsa");
  });

  it("names the main artist of releases that are not by Oöphoi", () => {
    expect(creditLine({ artist: "Klaus Wiese", credit: { with: ["Bernhard Jäger"] } })).toBe(
      "Klaus Wiese with Bernhard Jäger",
    );
  });
});

describe("releaseDescription", () => {
  const base = { title: "Genesis", year: 2002, typeLabel: "Album", labels: ["Stella Maris"] };

  it("names the artist behind an alias", () => {
    expect(
      releaseDescription({ ...base, artist: "Oöphoi", credit: { alias: "Nebula", with: ["Klaus Wiese", "Tau Ceti"] } }),
    ).toBe("Genesis (2002), album by Oöphoi as Nebula, with Klaus Wiese & Tau Ceti on Stella Maris.");
  });

  it("uses the release's own artist instead of assuming Oöphoi", () => {
    expect(
      releaseDescription({
        title: "Ruh",
        year: 2004,
        typeLabel: "Klaus Wiese remaster",
        labels: [],
        artist: "Klaus Wiese",
        credit: { alias: "Ruh Ensemble", with: [] },
      }),
    ).toBe("Ruh (2004), Klaus Wiese remaster by Klaus Wiese as Ruh Ensemble.");
  });

  it("lowercases the type inside the sentence, except acronyms and names", () => {
    const sentence = (typeLabel: string) => releaseDescription({ ...base, typeLabel, artist: "Oöphoi", credit: { with: [] }, labels: [] });
    expect(sentence("Compilation appearance")).toBe("Genesis (2002), compilation appearance by Oöphoi.");
    expect(sentence("EP")).toBe("Genesis (2002), EP by Oöphoi.");
  });

  it.each([
    ["Album", "album"],
    ["EP", "EP"],
    ["Minialbum", "minialbum"],
    ["Compilation appearance", "compilation appearance"],
    ["Box set", "box set"],
    ["Klaus Wiese remaster", "Klaus Wiese remaster"],
  ])("writes the release type label %s as %s inside the sentence", (typeLabel, expected) => {
    const sentence = releaseDescription({ ...base, typeLabel, artist: "Oöphoi", credit: { with: [] }, labels: [] });
    expect(sentence).toBe(`Genesis (2002), ${expected} by Oöphoi.`);
  });

  it("covers every release type label", () => {
    expect(Object.values(RELEASE_TYPE_LABELS).sort()).toEqual(
      ["Album", "Box set", "Compilation appearance", "EP", "Klaus Wiese remaster", "Minialbum"],
    );
  });

  it.each([
    ["CDr", "CDr"],
    ["DVD", "DVD"],
    ["A", "A"],
    ["box set", "box set"],
    ["Split with Tau Ceti", "split with Tau Ceti"],
    ["Live Album", "Live Album"],
  ])("leaves the edge case %s as %s", (typeLabel, expected) => {
    const sentence = releaseDescription({ ...base, typeLabel, artist: "Oöphoi", credit: { with: [] }, labels: [] });
    expect(sentence).toBe(`Genesis (2002), ${expected} by Oöphoi.`);
  });

  it("joins several labels and omits the label part when there is none", () => {
    expect(
      releaseDescription({ ...base, artist: "Oöphoi", credit: { with: [] }, labels: ["Aurora", "Umbra"] }),
    ).toBe("Genesis (2002), album by Oöphoi on Aurora, Umbra.");
    expect(releaseDescription({ ...base, artist: "Oöphoi", credit: { with: ["Tau Ceti"] }, labels: [] })).toBe(
      "Genesis (2002), album by Oöphoi with Tau Ceti.",
    );
  });
});

describe("relatedSlugs", () => {
  const all = [
    { slug: "athlit", hidden: false, relatedTo: undefined },
    { slug: "schwingungen", hidden: false, relatedTo: ["athlit"] },
    { slug: "hidden-version", hidden: true, relatedTo: ["athlit"] },
    { slug: "meditation", hidden: false, relatedTo: ["mare-vaporum", "missing"] },
    { slug: "mare-vaporum", hidden: false, relatedTo: undefined },
  ];

  it("combines outgoing and incoming links to visible releases only", () => {
    expect(relatedSlugs("athlit", all)).toEqual(["schwingungen"]);
    expect(relatedSlugs("meditation", all)).toEqual(["mare-vaporum"]);
    expect(relatedSlugs("mare-vaporum", all)).toEqual(["meditation"]);
  });
});
