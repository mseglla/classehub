import { useMemo, useState } from "react";
import { AppCard, FormField, PrimaryButton, ProgressDots, SecondaryButton } from "../components/ui";

function getSlug() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const classIndex = parts.indexOf("classe");
  if (classIndex >= 0 && parts[classIndex + 1]) return parts[classIndex + 1];
  return "orenetes";
}

const steps = [
  {
    id: "child",
    stepLabel: "Pas 1 de 3",
    title: "Dades de l’infant",
    text: "Comencem pel nom del fill o filla per crear l’accés familiar.",
  },
  {
    id: "adult",
    stepLabel: "Pas 2 de 3",
    title: "Adult de referència",
    text: "Només cal un adult per començar. Després podreu afegir més contactes.",
  },
  {
    id: "review",
    stepLabel: "Pas 3 de 3",
    title: "Revisa l’alta",
    text: "Si tot és correcte, crearem l’accés familiar a ClasseHub.",
  },
];

export default function FamilySignupPage() {
  const [slug] = useState(getSlug());
  const [currentStep, setCurrentStep] = useState(0);
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    childName: "",
    birthDate: "",
    adultName: "",
    email: "",
    phone: "",
  });

  const className = slug === "orenetes" ? "Orenetes" : slug;
  const step = steps[currentStep];

  const canContinue = useMemo(() => {
    if (step.id === "child") return formData.childName.trim().length >= 2;
    if (step.id === "adult") return formData.adultName.trim().length >= 2;
    return true;
  }, [formData.childName, formData.adultName, step.id]);

  function updateField(event) {
    const { name, value } = event.target;
    setMessage("");
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function nextStep() {
    if (!canContinue) {
      setMessage(
        step.id === "child"
          ? "Escriu el nom del fill/a per continuar."
          : "Escriu el nom de l’adult de referència per continuar."
      );
      return;
    }

    setMessage("");
    setCurrentStep((value) => Math.min(value + 1, steps.length - 1));
  }

  function previousStep() {
    setMessage("");
    setCurrentStep((value) => Math.max(value - 1, 0));
  }

  function submitSignup(event) {
    event.preventDefault();

    if (!formData.childName.trim() || !formData.adultName.trim()) {
      setMessage("Revisa les dades obligatòries abans de continuar.");
      return;
    }

    setMessage("Alta preparada. El següent pas serà crear el PIN familiar.");
  }

  return (
    <main className="ch-signup-screen">
      <AppCard className="ch-signup-card">
        <header className="ch-signup-header">
          <a href={`/classe/${slug}`} className="ch-signup-back">
            Ja tinc PIN
          </a>

          <div className="ch-signup-class">
            <span>🎒</span>
            <strong>{className}</strong>
          </div>
        </header>

        <ProgressDots steps={steps.length} currentStep={currentStep} />

        <div className="ch-signup-copy">
          <p>{step.stepLabel}</p>
          <h1>{step.title}</h1>
          <span>{step.text}</span>
        </div>

        <form className="ch-signup-form" onSubmit={submitSignup}>
          {step.id === "child" && (
            <div className="ch-signup-fields">
              <FormField label="Nom del fill/a">
                <input
                  type="text"
                  name="childName"
                  value={formData.childName}
                  onChange={updateField}
                  placeholder="Nil Segura"
                  autoComplete="off"
                  autoFocus
                />
              </FormField>

              <FormField
                label="Data de naixement"
                hint="Opcional. Ens ajuda a organitzar els aniversaris del trimestre."
              >
                <input
                  type="date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={updateField}
                />
              </FormField>
            </div>
          )}

          {step.id === "adult" && (
            <div className="ch-signup-fields">
              <FormField label="Nom adult de referència">
                <input
                  type="text"
                  name="adultName"
                  value={formData.adultName}
                  onChange={updateField}
                  placeholder="Marc Segura"
                  autoComplete="name"
                  autoFocus
                />
              </FormField>

              <FormField label="Email">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={updateField}
                  placeholder="Opcional"
                  autoComplete="email"
                />
              </FormField>

              <FormField label="Telèfon mòbil">
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={updateField}
                  placeholder="Opcional"
                  autoComplete="tel"
                />
              </FormField>
            </div>
          )}

          {step.id === "review" && (
            <div className="ch-signup-review">
              <div>
                <span>Infant</span>
                <strong>{formData.childName || "—"}</strong>
              </div>

              {formData.birthDate && (
                <div>
                  <span>Data de naixement</span>
                  <strong>{formData.birthDate}</strong>
                </div>
              )}

              <div>
                <span>Adult</span>
                <strong>{formData.adultName || "—"}</strong>
              </div>

              <div>
                <span>Contacte</span>
                <strong>
                  {[formData.email, formData.phone].filter(Boolean).join(" · ") ||
                    "Sense contacte informat"}
                </strong>
              </div>

              <p>
                Només cal una alta per família. Després podràs compartir el PIN
                amb l’altre adult.
              </p>
            </div>
          )}

          {message && <p className="ch-signup-message">{message}</p>}

          <div className="ch-signup-actions">
            {currentStep > 0 && (
              <SecondaryButton type="button" onClick={previousStep}>
                Tornar
              </SecondaryButton>
            )}

            {currentStep < steps.length - 1 ? (
              <PrimaryButton type="button" onClick={nextStep}>
                Continuar
              </PrimaryButton>
            ) : (
              <PrimaryButton type="submit">
                Crear accés familiar
              </PrimaryButton>
            )}
          </div>
        </form>

        <p className="ch-signup-note">
          Alta ràpida, privada i pensada per fer-la des del mòbil.
        </p>
      </AppCard>
    </main>
  );
}
