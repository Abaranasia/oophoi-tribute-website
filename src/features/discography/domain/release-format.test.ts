import { describe, expect, it } from "vitest";
import { creditLine, relatedSlugs } from "./release-format";

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
