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
  supabaseUrl: "https://fausqyfyrqlxdnymayfv.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhdXNxeWZ5cnFseGRueW1heWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxMDc0NzQsImV4cCI6MjExMDY4MzQ3NH0.rEhRQ1yxbPcmhFAsNIDJnsUD7RMWO8FM43-uzuObn2M", // public anon key. Never put the service_role key here.
};
