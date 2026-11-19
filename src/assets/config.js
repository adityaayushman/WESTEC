// Fill these in before launch. Nothing here is guessed: empty values switch the feature to its fallback.
window.WASTEC = {
  company: "Wastec",
  legalName: "Kukreja's Wastec Bio-Gas Private Limited",
  email: "",            // e.g. "sales@yourdomain.in"
  phone: "",            // e.g. "+91 98XXXXXXXX"
  whatsapp: "",         // digits only with country code, e.g. "9198XXXXXXXX"
  formEndpoint: "",     // optional third-party form URL. Not needed once supabaseUrl is set (leads go to the database).
  lpgPricePerKg: 100,   // default shown in the calculator

  // SaaS backend (Supabase). Both values are public by design; row-level security protects the data.
  supabaseUrl: "",      // e.g. "https://abcd1234.supabase.co"
  supabaseAnonKey: "",  // the project's anon / publishable key. Never put the service_role key here.
};
