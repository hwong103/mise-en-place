import { NextRequest } from "next/server";

import { GET } from "@/app/join/[token]/route";
import {
  clearGuestSessionCookie,
  resolveHouseholdFromShareToken,
  setGuestSessionCookie,
} from "@/lib/household-access";

vi.mock("@/lib/household-access", () => ({
  clearGuestSessionCookie: vi.fn(),
  resolveHouseholdFromShareToken: vi.fn(),
  setGuestSessionCookie: vi.fn(),
}));

describe("GET /join/[token]", () => {
  it("redirects invalid invite tokens", async () => {
    vi.mocked(resolveHouseholdFromShareToken).mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/join/invalid"), {
      params: Promise.resolve({ token: "invalid" }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/?join=invalid");
    expect(clearGuestSessionCookie).toHaveBeenCalled();
  });

  it("sets member session and redirects to recipes when token is valid", async () => {
    vi.mocked(resolveHouseholdFromShareToken).mockResolvedValue({
      householdId: "household_1",
      shareTokenVersion: 2,
    });

    const response = await GET(new NextRequest("http://localhost/join/abc"), {
      params: Promise.resolve({ token: "abc" }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/recipes");
    expect(setGuestSessionCookie).toHaveBeenCalledWith(expect.anything(), {
      householdId: "household_1",
      shareTokenVersion: 2,
      role: "member",
    });
  });
});
