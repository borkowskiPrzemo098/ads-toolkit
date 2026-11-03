import type { UtmValues } from "./build"

export interface UtmTemplate {
  id: string
  label: string
  /** Fields the template fills; the rest is left as the user typed it. */
  values: Partial<UtmValues>
  hint: string
}

/**
 * Starting points only: every field stays editable after a template is applied. Dynamic
 * parameters ({keyword}, {{ad.name}}) are filled in by the ad platform at click time.
 */
export const UTM_TEMPLATES: UtmTemplate[] = [
  {
    id: "google-search",
    label: "Google Ads Search",
    values: {
      utm_source: "google",
      utm_medium: "cpc",
      utm_term: "{keyword}",
      utm_content: "",
    },
    hint: "Przy włączonym autotagowaniu (gclid) UTM są opcjonalne. {keyword} wstawi Google Ads; wklej linię do pola „Sufiks końcowego adresu URL”.",
  },
  {
    id: "google-display",
    label: "Google Ads Display",
    values: {
      utm_source: "google",
      utm_medium: "display",
      utm_term: "",
      utm_content: "{placement}",
    },
    hint: "{placement} Google Ads zastąpi stroną, na której wyświetliła się reklama.",
  },
  {
    id: "facebook",
    label: "Facebook Ads",
    values: {
      utm_source: "facebook",
      utm_medium: "paid_social",
      utm_campaign: "{{campaign.name}}",
      utm_term: "",
      utm_content: "{{ad.name}}",
    },
    hint: "Parametry {{…}} Meta uzupełni nazwą kampanii i reklamy. Wklej link w polu „Parametry adresu URL” reklamy.",
  },
  {
    id: "newsletter",
    label: "Newsletter",
    values: { utm_source: "newsletter", utm_medium: "email", utm_term: "" },
    hint: "W utm_content możesz odróżnić linki w jednym mailu, np. przycisk_gora.",
  },
  {
    id: "mailing",
    label: "Mailing",
    values: { utm_source: "mailing", utm_medium: "email", utm_term: "" },
    hint: "Jako źródło możesz wpisać nazwę listy albo narzędzia do wysyłki.",
  },
  {
    id: "affiliate",
    label: "Kampania partnerska",
    values: { utm_source: "", utm_medium: "affiliate", utm_term: "" },
    hint: "Jako źródło wpisz nazwę partnera, a w utm_content jego identyfikator.",
  },
]
