// Ergänzung für angebrochene Flaschen in den Vorräten.
// Reihenfolge über die +/- Tasten: 0 → Rest → 1 → 2 → 3 …

function isBottleUnit(unit) {
  const normalizedUnit = normalize(unit).trim();
  return normalizedUnit === "flasche" || normalizedUnit === "flaschen";
}

function formatQuantityWithUnit(quantity, unit) {
  const shownQuantity =
    quantity == null || quantity === ""
      ? 0
      : Number(quantity);

  if (isBottleUnit(unit) && shownQuantity === 0.5) {
    return "Rest Flasche";
  }

  const shownUnit = displayUnit(shownQuantity, unit);
  return `${shownQuantity}${shownUnit ? " " + shownUnit : ""}`;
}

async function changeSupplyQuantity(id, delta) {
  const supply = supplies.find(
    (entry) => String(entry.id) === String(id)
  );

  if (!supply) return;

  const current = Number(supply.quantity ?? 0);
  let next;

  if (isBottleUnit(supply.unit)) {
    if (delta > 0) {
      if (current <= 0) {
        next = 0.5;
      } else if (current < 1) {
        next = 1;
      } else {
        next = current + 1;
      }
    } else {
      if (current > 1) {
        next = current - 1;
      } else if (current > 0.5) {
        next = 0.5;
      } else {
        next = 0;
      }
    }
  } else {
    next = Math.max(0, current + delta);
  }

  const status = automaticSupplyStatus(
    next,
    supply.minimum_quantity
  );

  try {
    const response = await authFetch(
      "/rest/v1/supplies?id=eq." + encodeURIComponent(id),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          quantity: next,
          stock_status: status,
        }),
      }
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        body.message ||
        body.error ||
        "Bestand konnte nicht geändert werden"
      );
    }

    supply.quantity = next;
    supply.stock_status = status;

    await syncSupplyShoppingState(supply);

    if (activeSupplyCategory) {
      const filtered = supplies.filter((item) =>
        supplyCategoriesFor(item).includes(activeSupplyCategory)
      );
      renderSupplies(filtered);
    } else {
      renderSupplies();
    }
  } catch (error) {
    alert(
      "Bestand konnte nicht geändert werden: " + error.message
    );
  }
}

function updateSupplyQuantityInputStep() {
  if (!els.supplyQuantity || !els.supplyUnit) return;

  const bottles = isBottleUnit(els.supplyUnit.value);
  els.supplyQuantity.step = bottles ? "0.5" : "1";
  els.supplyQuantity.inputMode = bottles ? "decimal" : "numeric";
}

updateSupplyQuantityInputStep();
els.supplyUnit?.addEventListener("change", updateSupplyQuantityInputStep);
