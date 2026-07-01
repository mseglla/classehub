import { useMemo, useState } from "react";
import { AppCard, FormField, PrimaryButton, ProgressDots, SecondaryButton } from "../components/ui";
import { supabase } from "../lib/supabase";

function getSlug() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const classIndex = parts.indexOf("classe");
  if (classIndex >= 0 && parts[classIndex + 1]) return parts[classIndex + 1];
  return "orenetes";
}

function saveFamilyAccessPin(slug, pin) {
  window.localStorage.setItem(`classehub-family-pin-${slug}`, pin);
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
    title: "Revisa les dades",
    text: "Encara no hem creat res. Revisa que tot sigui correcte abans de generar el PIN familiar.",
  },
];

export default function FamilySignupPage() {
  const [slug] = useState(getSlug());
  const [currentStep, setCurrentStep] = useState(0);
  const [message, setMessage] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");
  const [createdAccess, setCreatedAccess] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    childName: "",
    birthDate: "",
    adultName: "",
    email: "",
    phone: "",
  });

  const className = slug === "orenetes" ? "Orenetes" : slug;
  const step = steps[currentStep];
  const classUrl = `/classe/${slug}`;

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

  async function submitSignup(event) {
    event.preventDefault();

    if (!formData.childName.trim() || !formData.adultName.trim()) {
      setMessage("Revisa les dades obligatòries abans de continuar.");
      return;
    }

    setSaving(true);
    setMessage("");
    setSubmitStatus("");

    const { data, error } = await supabase.rpc("self_register_family", {
      p_class_slug: slug,
      p_child_name: formData.childName.trim(),
      p_child_birth_date: formData.birthDate || null,
      p_adult_name: formData.adultName.trim(),
      p_email: formData.email.trim() || null,
      p_phone: formData.phone.trim() || null,
    });

    setSaving(false);

    if (error) {
      console.error(error);
      setSubmitStatus("error");
      setMessage(`No s'ha pogut crear l'alta: ${error.message}`);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      setSubmitStatus("error");
      setMessage("No s'ha rebut resposta del servidor. Torna-ho a provar.");
      return;
    }

    if (result.status === "possible_duplicate") {
      setSubmitStatus("possible_duplicate");
      setMessage(result.message);
      return;
    }

    if (result.status !== "created" || !result.access_pin) {
      setSubmitStatus("error");
      setMessage(result.message || "No s'ha pogut completar l'alta.");
      return;
    }

    saveFamilyAccessPin(slug, result.access_pin);

    setCreatedAccess({
      familyId: result.family_id,
      accessPin: result.access_pin,
      childName: formData.childName.trim(),
      accessUrl: `${window.location.origin}${classUrl}?pin=${result.access_pin}`,
    });
    setSubmitStatus("created");
  }

  async function copyAccess() {
    if (!createdAccess) return;

    const accessMessage = `Hola! Per accedir a ClasseHub:

${createdAccess.accessUrl}

Família: ${createdAccess.childName}
PIN: ${createdAccess.accessPin}`;

    try {
      await navigator.clipboard.writeText(accessMessage);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch (error) {
      console.error(error);
      setMessage("No s'ha pogut copiar l'accés.");
    }
  }

  if (submitStatus === "created" && createdAccess) {
    return (
      <main className="ch-signup-screen">
        <AppCard className="ch-signup-card ch-signup-success-card">
          <div className="ch-signup-success-icon">✅</div>

          <div className="ch-signup-copy">
            <p>Alta completada</p>
            <h1>PIN familiar creat</h1>
            <span>
              Ja pots entrar a ClasseHub. Guarda aquest PIN o comparteix-lo
              amb l’altre adult de la família.
            </span>
          </div>

          <div className="ch-signup-pin-result">
            <span>PIN familiar</span>
            <strong>{createdAccess.accessPin}</strong>
          </div>

          <div className="ch-signup-actions">
            <SecondaryButton type="button" onClick={copyAccess}>
              {copied ? "Accés copiat!" : "Copiar accés"}
            </SecondaryButton>

            <PrimaryButton
              type="button"
              onClick={() => {
                window.location.href = `${classUrl}?pin=${createdAccess.accessPin}`;
              }}
            >
              Entrar a ClasseHub
            </PrimaryButton>
          </div>

          {message && <p className="ch-signup-message">{message}</p>}

          <p className="ch-signup-note">
            Més endavant podràs afegir altres contactes de la família.
          </p>
        </AppCard>
      </main>
    );
  }

  return (
    <main className="ch-signup-screen">
      <AppCard className="ch-signup-card">
        <header className="ch-signup-header">
          <a href={classUrl} className="ch-signup-back">
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

              <FormField
                label="Email"
                hint="Opcional. El farem servir només per avisos importants de la classe o per ajudar-te a recuperar l’accés familiar."
              >
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={updateField}
                  placeholder="nom@email.com"
                  autoComplete="email"
                />
              </FormField>

              <FormField
                label="Telèfon mòbil"
                hint="Opcional. Pot servir perquè el delegat pugui contactar amb la família si cal. No t’afegirem a cap grup sense permís."
              >
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

          {submitStatus === "possible_duplicate" && (
            <div className="ch-signup-actions">
              <SecondaryButton
                type="button"
                onClick={() => {
                  setSubmitStatus("");
                  setMessage("");
                  setCurrentStep(0);
                }}
              >
                Revisar dades
              </SecondaryButton>

              <PrimaryButton
                type="button"
                onClick={() => {
                  window.location.href = classUrl;
                }}
              >
                Entrar amb PIN
              </PrimaryButton>
            </div>
          )}

          {submitStatus !== "possible_duplicate" && (
            <div className="ch-signup-actions ch-signup-actions-clean">
              {currentStep < steps.length - 1 ? (
                <PrimaryButton
                  key={`continue-${currentStep}`}
                  type="button"
                  onClick={nextStep}
                >
                  Continuar
                </PrimaryButton>
              ) : (
                <PrimaryButton
                  key="create-pin"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Creant PIN..." : "Crear PIN familiar"}
                </PrimaryButton>
              )}

              {currentStep > 0 && (
                <button
                  key={`back-${currentStep}`}
                  type="button"
                  className="ch-signup-back-button"
                  onClick={previousStep}
                >
                  Tornar al pas anterior
                </button>
              )}
            </div>
          )}
        </form>

        <p className="ch-signup-note">
          Alta ràpida, privada i pensada per fer-la des del mòbil.
        </p>
      </AppCard>
    </main>
  );
}
