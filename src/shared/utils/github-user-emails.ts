export type GitHubVerifiedEmail = {
  email: string;
  /** Marcado como principal en la cuenta de GitHub (API /user/emails). */
  primary: boolean;
};

/**
 * Correos verificados con metadatos (`user:email`).
 * Passport a veces no rellena `profile.emails` si el correo está oculto en GitHub.
 */
export async function fetchGitHubVerifiedEmailDetails(
  accessToken: string
): Promise<GitHubVerifiedEmail[]> {
  const res = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "portfolio-api-oauth"
    }
  });

  if (!res.ok) {
    return [];
  }

  const body: unknown = await res.json();
  const rows = Array.isArray(body)
    ? (body as Array<{
        email?: string;
        verified?: boolean;
        primary?: boolean;
      }>)
    : [];

  return rows
    .filter(
      r => r.verified && typeof r.email === "string" && r.email.length > 0
    )
    .map(r => ({
      email: r.email!.trim(),
      primary: r.primary === true
    }));
}

/**
 * Lista correos verificados del usuario con el token OAuth (`user:email`).
 */
export async function fetchVerifiedGitHubEmails(
  accessToken: string
): Promise<string[]> {
  const rows = await fetchGitHubVerifiedEmailDetails(accessToken);
  return rows.map(r => r.email);
}

const NOREPLY_SUFFIX = "@users.noreply.github.com";

function isGitHubNoreply(email: string): boolean {
  return email.toLowerCase().endsWith(NOREPLY_SUFFIX);
}

/**
 * Elige correo para login: si el `primary` de GitHub es noreply, se prefieren otros
 * correos verificados reales; si no hay ninguno, se usa noreply o el perfil de Passport.
 */
export function pickGitHubLoginEmail(
  apiEmails: GitHubVerifiedEmail[],
  profileEmails: string[] | undefined
): string | undefined {
  // GitHub puede marcar como `primary` la dirección noreply si "Keep my email private"
  // está activo; priorizamos siempre un correo verificado real si existe.
  const primary = apiEmails.find(e => e.primary);
  if (primary && !isGitHubNoreply(primary.email)) {
    return primary.email;
  }

  const apiNonNoreply = apiEmails.find(e => !isGitHubNoreply(e.email));
  if (apiNonNoreply) {
    return apiNonNoreply.email;
  }

  if (primary) {
    return primary.email;
  }

  for (const raw of profileEmails ?? []) {
    const v = raw.trim();
    if (v && !isGitHubNoreply(v)) {
      return v;
    }
  }

  if (apiEmails[0]) {
    return apiEmails[0].email;
  }

  const firstProfile = profileEmails?.map(e => e.trim()).find(Boolean);
  if (firstProfile) {
    return firstProfile;
  }

  return undefined;
}
