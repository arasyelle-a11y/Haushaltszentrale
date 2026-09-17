// Vorräte: angebrochene Flaschen + Mehrfacheingabe

function isBottleUnit(unit) {
  const value = normalize(unit).trim();
  return value === "flasche" || value === "flaschen";
}

function parseBottleQuantity(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "rest") return 0.5;
  if (!raw) return 0;
  const number = Number(raw.replace(",", "."));
  return Number.isFinite(number) && number >= 0 ? number : NaN;
}

function formatQuantityWithUnit(quantity, unit) {
  const shownQuantity = quantity == null || quantity === "" ? 0 : Number(quantity);

  if (isBottleUnit(unit) && shownQuantity === 0.5) {
    return "Rest Flasche";
  }

  const shownUnit = displayUnit(shownQuantity, unit);
  return `${shownQuantity}${shownUnit ? " " + shownUnit : ""}`;
}

async function changeSupplyQuantity(id, delta) {
  const supply = supplies.find((entry) => String(entry.id) === String(id));
  if (!supply) return;

  const current = Number(supply.quantity ?? 0);
  let next;

  if (isBottleUnit(supply.unit)) {
    if (delta > 0) {
      next = current <= 0 ? 0.5 : current < 1 ? 1 : current + 1;
    } else {
      next = current > 1 ? current - 1 : current > 0.5 ? 0.5 : 0;
    }
  } else {
    next = Math.max(0, current + delta);
  }

  const status = automaticSupplyStatus(next, supply.minimum_quantity);

  try {
    const response = await authFetch(
      "/rest/v1/supplies?id=eq." + encodeURIComponent(id),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ quantity: next, stock_status: status }),
      }
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || body.error || "Bestand konnte nicht geändert werden");
    }

    supply.quantity = next;
    supply.stock_status = status;
    await syncSupplyShoppingState(supply);

    if (activeSupplyCategory) {
      renderSupplies(
        supplies.filter((item) =>
          supplyCategoriesFor(item).includes(activeSupplyCategory)
        )
      );
    } else {
      renderSupplies();
    }
  } catch (error) {
    alert("Bestand konnte nicht geändert werden: " + error.message);
  }
}

function updateSupplyQuantityInput() {
  if (!els.supplyQuantity || !els.supplyUnit) return;

  const bottles = isBottleUnit(els.supplyUnit.value);
  const currentValue = els.supplyQuantity.value;

  if (bottles) {
    els.supplyQuantity.type = "text";
    els.supplyQuantity.inputMode = "text";
    els.supplyQuantity.removeAttribute("min");
    els.supplyQuantity.removeAttribute("step");
    els.supplyQuantity.placeholder = "0, 1, 2 … oder Rest";

    if (Number(currentValue) === 0.5) {
      els.supplyQuantity.value = "Rest";
    }
  } else {
    let restoredValue = currentValue;
    if (String(currentValue).trim().toLowerCase() === "rest") {
      restoredValue = "0.5";
    } else {
      restoredValue = String(currentValue).replace(",", ".");
    }

    els.supplyQuantity.type = "number";
    els.supplyQuantity.inputMode = "numeric";
    els.supplyQuantity.min = "0";
    els.supplyQuantity.step = "1";
    els.supplyQuantity.placeholder = "0";
    els.supplyQuantity.value = restoredValue;
  }
}

// Vor dem normalen Speichern "Rest" und deutsche Kommas in eine Zahl umwandeln.
els.supplyForm?.addEventListener(
  "submit",
  (event) => {
    if (!isBottleUnit(els.supplyUnit.value)) return;

    const parsed = parseBottleQuantity(els.supplyQuantity.value);
    if (!Number.isFinite(parsed)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert("Bitte beim Bestand eine Zahl oder „Rest“ eingeben.");
      els.supplyQuantity.focus();
      return;
    }

    els.supplyQuantity.value = String(parsed);
  },
  true
);

els.supplyUnit?.addEventListener("change", updateSupplyQuantityInput);

const originalOpenEditSupplyForBottleRest = openEditSupply;
openEditSupply = function (...args) {
  const result = originalOpenEditSupplyForBottleRest(...args);
  updateSupplyQuantityInput();
  return result;
};

const originalOpenNewSupplyForBottleRest = openNewSupply;
openNewSupply = function (...args) {
  const result = originalOpenNewSupplyForBottleRest(...args);
  updateSupplyQuantityInput();
  return result;
};

updateSupplyQuantityInput();

// ===== Mehrere Vorräte am gleichen Ort eintragen =====

function parseBulkSupplyLines(text, unit) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^(.*\S)\s+(rest|\d+(?:[.,]\d+)?)$/i);

      if (!match) {
        throw new Error(
          `Zeile ${index + 1} konnte nicht gelesen werden: „${line}“. Bitte z. B. „Gin 2“ eingeben.`
        );
      }

      const name = match[1].trim();
      const amountText = match[2].toLowerCase();
      const quantity = amountText === "rest"
        ? (isBottleUnit(unit) ? 0.5 : NaN)
        : Number(amountText.replace(",", "."));

      if (amountText === "rest" && !isBottleUnit(unit)) {
        throw new Error(`Zeile ${index + 1}: „Rest“ ist nur bei Flaschen möglich.`);
      }

      if (!name || !Number.isFinite(quantity) || quantity < 0) {
        throw new Error(`Zeile ${index + 1} enthält keine gültige Menge.`);
      }

      return { name, quantity };
    });
}

function ensureBulkSupplyUi() {
  if (document.getElementById("bulkSupplyDialog")) return;

  const addButton = (referenceButton) => {
    if (!referenceButton || referenceButton.parentElement.querySelector(".bulk-supply-btn")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-btn bulk-supply-btn";
    button.textContent = "＋ Mehrere";
    referenceButton.insertAdjacentElement("afterend", button);
    button.addEventListener("click", openBulkSupplyDialog);
  };

  addButton(els.addSupplyBtn);
  addButton(els.addSupplyInCategoryBtn);

  const dialog = document.createElement("dialog");
  dialog.id = "bulkSupplyDialog";
  dialog.innerHTML = `
    <form id="bulkSupplyForm">
      <div class="dialog-head">
        <div>
          <p class="eyebrow">VORRÄTE</p>
          <h2>Mehrere Artikel eintragen</h2>
        </div>
        <button type="button" class="icon-btn" id="closeBulkSupplyDialog" aria-label="Schließen">✕</button>
      </div>

      <label>Artikel und Menge*
        <textarea id="bulkSupplyLines" rows="7" required placeholder="Vodka 2,5\nGin 2\nSekt 3\nWhisky Rest"></textarea>
        <span class="hint">Ein Artikel pro Zeile. Bei Flaschen geht auch „Rest“.</span>
      </label>

      <label>Kategorie*
        <select id="bulkSupplyCategory" required></select>
      </label>

      <label>Raum / Bereich
        <input id="bulkSupplyRoom" value="Vorratsraum" placeholder="z. B. Vorratsraum">
      </label>

      <label>Lagerplatz
        <input id="bulkSupplyLocation" placeholder="z. B. Regal oben links">
      </label>

      <div class="supply-form-grid">
        <label>Einheit
          <select id="bulkSupplyUnit">
            <option value="">–</option>
            <option>Packungen</option>
            <option selected>Flaschen</option>
            <option>Gläser</option>
            <option>Dosen</option>
            <option>Stück</option>
            <option>kg</option>
            <option>g</option>
            <option>l</option>
            <option>ml</option>
          </select>
        </label>

        <label>Mindestbestand
          <input id="bulkSupplyMinimum" type="number" min="0" step="1" value="0" inputmode="numeric">
        </label>
      </div>

      <p id="bulkSupplyStatus" class="status-text"></p>

      <div class="dialog-actions">
        <span class="spacer"></span>
        <button type="button" id="cancelBulkSupplyBtn" class="secondary-btn">Abbrechen</button>
        <button type="submit" class="primary-btn">Alle anlegen</button>
      </div>
    </form>`;

  document.body.appendChild(dialog);

  document.getElementById("closeBulkSupplyDialog")?.addEventListener("click", () => dialog.close());
  document.getElementById("cancelBulkSupplyBtn")?.addEventListener("click", () => dialog.close());
  document.getElementById("bulkSupplyForm")?.addEventListener("submit", saveBulkSupplies);
}

function fillBulkSupplyCategories() {
  const select = document.getElementById("bulkSupplyCategory");
  if (!select) return;

  const categories = allKnownSupplyCategoryNames();
  select.innerHTML = "";

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });

  const preferred = activeSupplyCategory ||
    (categories.includes("Getränke") ? "Getränke" : categories[0] || "");

  if (preferred) select.value = preferred;
}

function openBulkSupplyDialog() {
  ensureBulkSupplyUi();
  const form = document.getElementById("bulkSupplyForm");
  form?.reset();

  document.getElementById("bulkSupplyRoom").value = "Vorratsraum";
  document.getElementById("bulkSupplyUnit").value = "Flaschen";
  document.getElementById("bulkSupplyMinimum").value = "0";
  document.getElementById("bulkSupplyStatus").textContent = "";

  fillBulkSupplyCategories();
  document.getElementById("bulkSupplyDialog")?.showModal();
  document.getElementById("bulkSupplyLines")?.focus();
}

async function saveBulkSupplies(event) {
  event.preventDefault();

  const status = document.getElementById("bulkSupplyStatus");
  const lines = document.getElementById("bulkSupplyLines")?.value || "";
  const category = document.getElementById("bulkSupplyCategory")?.value || "";
  const room = document.getElementById("bulkSupplyRoom")?.value.trim() || "Vorratsraum";
  const storageLocation = document.getElementById("bulkSupplyLocation")?.value.trim() || null;
  const unit = document.getElementById("bulkSupplyUnit")?.value || null;
  const minimum = Number(document.getElementById("bulkSupplyMinimum")?.value || 0);

  try {
    if (!category) throw new Error("Bitte eine Kategorie auswählen.");

    const parsed = parseBulkSupplyLines(lines, unit);
    if (!parsed.length) throw new Error("Bitte mindestens einen Artikel eintragen.");

    const records = parsed.map(({ name, quantity }) => ({
      name,
      categories: [category],
      category,
      room,
      storage_location: storageLocation,
      quantity,
      unit,
      minimum_quantity: Number.isFinite(minimum) ? minimum : 0,
      best_before: null,
      note: null,
      stock_status: automaticSupplyStatus(quantity, Number.isFinite(minimum) ? minimum : 0),
    }));

    status.textContent = `${records.length} Artikel werden gespeichert …`;
    status.classList.remove("error-text");

    const response = await authFetch("/rest/v1/supplies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(records),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || body.error || "Artikel konnten nicht gespeichert werden.");
    }

    document.getElementById("bulkSupplyDialog")?.close();
    await loadSupplies();
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("error-text");
  }
}

ensureBulkSupplyUi();
