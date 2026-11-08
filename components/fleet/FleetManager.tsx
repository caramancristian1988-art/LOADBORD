"use client";

import { Pencil, Plus, Search, Trash2, Truck, UserPlus, Link2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Empty, EquipBadge, ErrorNote, Field, Modal, StatusBadge } from "@/components/ui";
import { CityInput } from "@/components/board/CityInput";
import { api } from "@/lib/api-client";
import { EQUIPMENT } from "@/lib/sim/data/freight";
import { addDaysIso, isoDay, money, shortDay, todayIso } from "@/lib/format";
import { canHaul, equipName, STATUS_LABEL } from "@/lib/sim/equipment";
import { toQuery } from "@/lib/search-params";
import type { EquipCode } from "@/lib/sim/types";
import { ALL_EQUIPMENT } from "@/lib/search-params";

type Driver = { id: string; name: string; phone: string; email: string | null; cdlState: string; hosHoursLeft: number; active: boolean; trucks?: { number: string }[] };
type TruckRow = {
  id: string;
  number: string;
  equipment: EquipCode;
  trailerLength: number;
  maxWeight: number;
  city: string;
  state: string;
  status: "AVAILABLE" | "ON_LOAD" | "OUT_OF_SERVICE";
  availableDate: string;
  notes: string | null;
  driverId: string | null;
  driver: Driver | null;
};
type Booked = { id: string; ref: string; status: string; truckId: string | null; originCity: string; originState: string; destCity: string; destState: string; pickupDate: string; deliveryDate: string; equipment: EquipCode; weight: number; bookedRate: number | null };

const TRUCK_STATUS_LABEL = { AVAILABLE: "Available", ON_LOAD: "On load", OUT_OF_SERVICE: "Out of service" };

const emptyTruck = () => ({
  number: "",
  equipment: "F" as EquipCode,
  trailerLength: 48,
  maxWeight: 48000,
  location: "",
  availableDate: todayIso(),
  status: "AVAILABLE" as TruckRow["status"],
  driverId: "",
  notes: "",
});
const emptyDriver = () => ({ name: "", phone: "", email: "", cdlState: "", hosHoursLeft: 70 });

export function FleetManager({ data }: { data: { trucks: TruckRow[]; drivers: Driver[]; booked: Booked[] } }) {
  const router = useRouter();
  const { trucks, drivers, booked } = data;
  const [truckForm, setTruckForm] = useState<null | { id?: string; v: ReturnType<typeof emptyTruck> }>(null);
  const [driverForm, setDriverForm] = useState<null | { id?: string; v: ReturnType<typeof emptyDriver> }>(null);
  const [assignFor, setAssignFor] = useState<TruckRow | null>(null);
  const [confirmDel, setConfirmDel] = useState<null | { kind: "truck" | "driver"; id: string; label: string }>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      after?.();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function searchHref(t: TruckRow) {
    const today = todayIso();
    const avail = isoDay(t.availableDate);
    const pf = avail > today ? avail : today;
    return `/loads/search?${toQuery({
      origin: `${t.city}, ${t.state}`,
      dho: 150,
      equipment: t.equipment === "SD" ? ["SD", "F"] : t.equipment === "CN" ? ["CN", "F"] : [t.equipment],
      pickupFrom: pf,
      pickupTo: addDaysIso(pf, 2),
      weightMax: t.maxWeight,
      lengthMax: t.trailerLength,
    }).toString()}`;
  }

  const loadsOf = (truckId: string) => booked.filter((b) => b.truckId === truckId);
  const unassignedOrOther = (t: TruckRow) => booked.filter((b) => b.status === "BOOKED" && b.truckId !== t.id && canHaul(t.equipment, b.equipment) && b.weight <= t.maxWeight);

  function truckActions(t: TruckRow) {
    return (
      <>
        <Link className="btn btn-primary btn-sm" href={searchHref(t)} title="Search loads near this truck">
          <Search size={13} /> Find loads
        </Link>
        <button className="btn btn-outline btn-sm" onClick={() => setAssignFor(t)} title="Assign a booked load">
          <Link2 size={13} /> Assign load
        </button>
        <button
          className="btn btn-outline btn-sm"
          title="Edit"
          aria-label={`Edit truck #${t.number}`}
          onClick={() =>
            setTruckForm({
              id: t.id,
              v: {
                number: t.number,
                equipment: t.equipment,
                trailerLength: t.trailerLength,
                maxWeight: t.maxWeight,
                location: `${t.city}, ${t.state}`,
                availableDate: isoDay(t.availableDate),
                status: t.status,
                driverId: t.driverId ?? "",
                notes: t.notes ?? "",
              },
            })
          }
        >
          <Pencil size={13} />
        </button>
        <button className="btn btn-danger btn-sm" title="Delete" aria-label={`Delete truck #${t.number}`} onClick={() => setConfirmDel({ kind: "truck", id: t.id, label: `truck #${t.number}` })}>
          <Trash2 size={13} />
        </button>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ErrorNote>{!truckForm && !driverForm && !assignFor && !confirmDel ? error : null}</ErrorNote>

      {/* trucks */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-bold">
            Trucks <span className="text-muted">({trucks.length})</span>
          </h2>
          <button className="btn btn-primary" onClick={() => setTruckForm({ v: emptyTruck() })}>
            <Plus size={15} /> Add truck
          </button>
        </div>
        {/* phones: one card per truck */}
        {trucks.length > 0 && (
          <div className="flex flex-col gap-3 md:hidden">
            {trucks.map((t) => {
              const ls = loadsOf(t.id);
              return (
                <div key={t.id} className="card p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-bold">#{t.number}</span>
                    <EquipBadge code={t.equipment} full />
                    <span className="ml-auto">
                      <StatusBadge status={t.status === "AVAILABLE" ? "AVAILABLE_TRUCK" : t.status} label={TRUCK_STATUS_LABEL[t.status]} />
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
                    <span className="text-muted">Location</span>
                    <span>
                      {t.city}, {t.state}
                    </span>
                    <span className="text-muted">Available</span>
                    <span>{shortDay(t.availableDate)}</span>
                    <span className="text-muted">Trailer</span>
                    <span>
                      {t.trailerLength} ft · {t.maxWeight.toLocaleString("en-US")} lbs
                    </span>
                    <span className="text-muted">Driver</span>
                    <span className={t.driver ? "" : "text-bad"}>{t.driver ? `${t.driver.name} · ${t.driver.phone}` : "No driver"}</span>
                  </div>
                  {ls.length > 0 && (
                    <div className="mt-2 space-y-0.5 text-[12.5px]">
                      {ls.map((l) => (
                        <Link key={l.id} href={`/loads/${l.id}`} className="block text-primary">
                          {l.ref} · {l.originCity} → {l.destCity} · {STATUS_LABEL[l.status]}
                        </Link>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2 [&>*]:h-9">{truckActions(t)}</div>
                </div>
              );
            })}
          </div>
        )}
        <div className={`card overflow-x-auto ${trucks.length ? "hidden md:block" : ""}`}>
          {trucks.length === 0 ? (
            <Empty title="No trucks yet" icon={<Truck size={34} />}>
              Add your first truck to start booking loads.
            </Empty>
          ) : (
            <table className="dt">
              <thead>
                <tr>
                  <th>Truck #</th>
                  <th>Trailer</th>
                  <th className="text-right">Max weight</th>
                  <th>Current location</th>
                  <th>Next available</th>
                  <th>Status</th>
                  <th>Driver</th>
                  <th>Assigned loads</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trucks.map((t) => {
                  const ls = loadsOf(t.id);
                  return (
                    <tr key={t.id}>
                      <td className="font-bold">#{t.number}</td>
                      <td>
                        <span className="flex items-center gap-2">
                          <EquipBadge code={t.equipment} /> {equipName(t.equipment)} · {t.trailerLength} ft
                        </span>
                      </td>
                      <td className="tnum text-right">{t.maxWeight.toLocaleString("en-US")} lbs</td>
                      <td>
                        {t.city}, {t.state}
                      </td>
                      <td className="tnum">{shortDay(t.availableDate)}</td>
                      <td>
                        <StatusBadge status={t.status === "AVAILABLE" ? "AVAILABLE_TRUCK" : t.status} label={TRUCK_STATUS_LABEL[t.status]} />
                      </td>
                      <td className="leading-[1.3]">
                        {t.driver ? (
                          <>
                            <div className="font-medium">{t.driver.name}</div>
                            <div className="text-[11.5px] text-muted">{t.driver.phone}</div>
                          </>
                        ) : (
                          <span className="text-bad">No driver</span>
                        )}
                      </td>
                      <td className="text-[12.5px] leading-[1.35]">
                        {ls.length === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          ls.map((l) => (
                            <div key={l.id}>
                              <Link className="font-mono text-primary hover:underline" href={`/loads/${l.id}`}>
                                {l.ref}
                              </Link>{" "}
                              <span className="text-muted">
                                {l.originCity} → {l.destCity} · {STATUS_LABEL[l.status]}
                              </span>
                            </div>
                          ))
                        )}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">{truckActions(t)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* drivers */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-bold">
            Drivers <span className="text-muted">({drivers.length})</span>
          </h2>
          <button className="btn btn-outline" onClick={() => setDriverForm({ v: emptyDriver() })}>
            <UserPlus size={15} /> Add driver
          </button>
        </div>
        <div className="card overflow-x-auto">
          {drivers.length === 0 ? (
            <Empty title="No drivers yet">Add drivers and assign them to trucks.</Empty>
          ) : (
            <table className="dt">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>CDL state</th>
                  <th className="text-right">HOS left (70 hr)</th>
                  <th>Truck</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium">{d.name}</td>
                    <td className="tnum">{d.phone}</td>
                    <td>{d.email ?? <span className="text-muted">—</span>}</td>
                    <td>{d.cdlState}</td>
                    <td className="tnum text-right">{d.hosHoursLeft} h</td>
                    <td>{d.trucks?.length ? d.trucks.map((t) => `#${t.number}`).join(", ") : <span className="text-muted">Unassigned</span>}</td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setDriverForm({ id: d.id, v: { name: d.name, phone: d.phone, email: d.email ?? "", cdlState: d.cdlState, hosHoursLeft: d.hosHoursLeft } })}
                        >
                          <Pencil size={13} />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel({ kind: "driver", id: d.id, label: d.name })}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* truck form */}
      <Modal
        open={!!truckForm}
        onClose={() => setTruckForm(null)}
        title={truckForm?.id ? `Edit truck #${truckForm.v.number}` : "Add truck"}
        width={560}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setTruckForm(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                truckForm &&
                run(
                  () => api(truckForm.id ? `/api/trucks/${truckForm.id}` : "/api/trucks", { method: truckForm.id ? "PUT" : "POST", body: { ...truckForm.v, driverId: truckForm.v.driverId || null } }),
                  () => setTruckForm(null),
                )
              }
            >
              {truckForm?.id ? "Save" : "Add truck"}
            </button>
          </>
        }
      >
        {truckForm && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Truck number">
              <input className="input" value={truckForm.v.number} onChange={(e) => setTruckForm({ ...truckForm, v: { ...truckForm.v, number: e.target.value } })} placeholder="105" />
            </Field>
            <Field label="Trailer type">
              <select
                className="input"
                value={truckForm.v.equipment}
                onChange={(e) => {
                  const eq = e.target.value as EquipCode;
                  setTruckForm({ ...truckForm, v: { ...truckForm.v, equipment: eq, trailerLength: EQUIPMENT[eq].len, maxWeight: EQUIPMENT[eq].maxWt } });
                }}
              >
                {ALL_EQUIPMENT.map((c) => (
                  <option key={c} value={c}>
                    {EQUIPMENT[c].name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Trailer length (ft)">
              <input className="input" type="number" value={truckForm.v.trailerLength} onChange={(e) => setTruckForm({ ...truckForm, v: { ...truckForm.v, trailerLength: Number(e.target.value) } })} />
            </Field>
            <Field label="Max cargo weight (lbs)">
              <input className="input" type="number" value={truckForm.v.maxWeight} onChange={(e) => setTruckForm({ ...truckForm, v: { ...truckForm.v, maxWeight: Number(e.target.value) } })} />
            </Field>
            <CityInput label="Current city / state" allowState={false} value={truckForm.v.location} onChange={(v) => setTruckForm({ ...truckForm, v: { ...truckForm.v, location: v } })} placeholder="Dallas, TX" />
            <Field label="Next available date">
              <input className="input" type="date" value={truckForm.v.availableDate} onChange={(e) => setTruckForm({ ...truckForm, v: { ...truckForm.v, availableDate: e.target.value } })} />
            </Field>
            <Field label="Availability">
              <select className="input" value={truckForm.v.status} onChange={(e) => setTruckForm({ ...truckForm, v: { ...truckForm.v, status: e.target.value as TruckRow["status"] } })}>
                <option value="AVAILABLE">Available</option>
                <option value="ON_LOAD">On load</option>
                <option value="OUT_OF_SERVICE">Out of service</option>
              </select>
            </Field>
            <Field label="Driver">
              <select className="input" value={truckForm.v.driverId} onChange={(e) => setTruckForm({ ...truckForm, v: { ...truckForm.v, driverId: e.target.value } })}>
                <option value="">— none —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.phone}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notes" className="col-span-2">
              <input className="input" value={truckForm.v.notes} onChange={(e) => setTruckForm({ ...truckForm, v: { ...truckForm.v, notes: e.target.value } })} placeholder="Optional — e.g. has ramps, 8 ft tarps" />
            </Field>
            <div className="col-span-2">
              <ErrorNote>{error}</ErrorNote>
            </div>
          </div>
        )}
      </Modal>

      {/* driver form */}
      <Modal
        open={!!driverForm}
        onClose={() => setDriverForm(null)}
        title={driverForm?.id ? "Edit driver" : "Add driver"}
        width={480}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setDriverForm(null)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => driverForm && run(() => api(driverForm.id ? `/api/drivers/${driverForm.id}` : "/api/drivers", { method: driverForm.id ? "PUT" : "POST", body: driverForm.v }), () => setDriverForm(null))}
            >
              {driverForm?.id ? "Save" : "Add driver"}
            </button>
          </>
        }
      >
        {driverForm && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" className="col-span-2">
              <input className="input" value={driverForm.v.name} onChange={(e) => setDriverForm({ ...driverForm, v: { ...driverForm.v, name: e.target.value } })} />
            </Field>
            <Field label="Phone">
              <input className="input" value={driverForm.v.phone} onChange={(e) => setDriverForm({ ...driverForm, v: { ...driverForm.v, phone: e.target.value } })} placeholder="(555) 555-0100" />
            </Field>
            <Field label="CDL state">
              <input className="input uppercase" maxLength={2} value={driverForm.v.cdlState} onChange={(e) => setDriverForm({ ...driverForm, v: { ...driverForm.v, cdlState: e.target.value } })} placeholder="TX" />
            </Field>
            <Field label="Email (optional)">
              <input className="input" value={driverForm.v.email} onChange={(e) => setDriverForm({ ...driverForm, v: { ...driverForm.v, email: e.target.value } })} />
            </Field>
            <Field label="HOS hours left">
              <input className="input" type="number" value={driverForm.v.hosHoursLeft} onChange={(e) => setDriverForm({ ...driverForm, v: { ...driverForm.v, hosHoursLeft: Number(e.target.value) } })} />
            </Field>
            <div className="col-span-2">
              <ErrorNote>{error}</ErrorNote>
            </div>
          </div>
        )}
      </Modal>

      {/* assign booked load to truck */}
      <Modal open={!!assignFor} onClose={() => setAssignFor(null)} title={`Assign a booked load to truck #${assignFor?.number ?? ""}`} width={620}>
        {assignFor && (
          <div className="flex flex-col gap-3">
            <ErrorNote>{error}</ErrorNote>
            {unassignedOrOther(assignFor).length === 0 ? (
              <Empty title="No compatible booked loads">
                Book a {equipName(assignFor.equipment)} load first, or check weight limits.{" "}
                <Link href={searchHref(assignFor)} className="text-primary hover:underline">
                  Find loads for this truck
                </Link>
              </Empty>
            ) : (
              <table className="dt">
                <thead>
                  <tr>
                    <th>Load</th>
                    <th>Lane</th>
                    <th>Pick up</th>
                    <th className="text-right">Rate</th>
                    <th>Currently</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {unassignedOrOther(assignFor).map((b) => (
                    <tr key={b.id}>
                      <td className="font-mono">{b.ref}</td>
                      <td>
                        {b.originCity}, {b.originState} → {b.destCity}, {b.destState}
                      </td>
                      <td className="tnum">{shortDay(b.pickupDate)}</td>
                      <td className="tnum text-right">{money(b.bookedRate)}</td>
                      <td className="text-muted">{b.truckId ? `truck #${trucks.find((t) => t.id === b.truckId)?.number ?? "?"}` : "unassigned"}</td>
                      <td className="text-right">
                        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => api(`/api/loads/${b.id}/assign`, { body: { truckId: assignFor.id } }), () => setAssignFor(null))}>
                          Assign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        title={`Delete ${confirmDel?.label ?? ""}?`}
        width={420}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setConfirmDel(null)}>
              Keep
            </button>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={() => confirmDel && run(() => api(`/api/${confirmDel.kind === "truck" ? "trucks" : "drivers"}/${confirmDel.id}`, { method: "DELETE" }), () => setConfirmDel(null))}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="text-[13px] text-muted">This can&apos;t be undone. Records with active loads can&apos;t be deleted.</p>
        <div className="mt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      </Modal>
    </div>
  );
}
