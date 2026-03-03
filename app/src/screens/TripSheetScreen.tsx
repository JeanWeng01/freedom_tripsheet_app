import { useState } from 'react';
import { Camera, Send, Building2, Navigation, MapPin, Plus, Trash2, Flag, Truck } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TripSheet, TripStop, SRStop, LHStop, MDCStop, SegmentStop, TruckStop } from '../types';
import TripHeader from '../components/TripHeader';
import StopCard from '../components/StopCard';
import MDCCard from '../components/MDCCard';
import SegmentCard from '../components/SegmentCard';
import TruckCard from '../components/TruckCard';
import ValidationModal from '../components/ValidationModal';
import LHRequisitionTab from './LHRequisitionTab';
import { makeSRStop, makeLHStop, makeMDCStop, makeSpecialMDCStop, makeSegmentStop, makeTruckStop, getMDCAllowance } from '../utils/tripUtils';
import { validateTrip } from '../utils/validation';

interface Props {
  trip: TripSheet;
  onTripChange: (t: TripSheet) => void;
  onSubmit: (t: TripSheet) => void;
  onDiscard: () => void;
}

type Tab = 'trip' | 'lh';

function SortableStop({ stop, index, allStops, onUpdate, onDelete, onPhotoAdd }: {
  stop: TripStop; index: number; allStops: TripStop[];
  onUpdate: (s: TripStop) => void; onDelete: () => void; onPhotoAdd: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : undefined };

  const dragHandleProps = { ...attributes, ...listeners };

  // Segment stops — simple divider card
  if (stop.type === 'segment') {
    return (
      <div ref={setNodeRef} style={style}>
        <SegmentCard
          stop={stop as SegmentStop}
          onChange={s => onUpdate(s)}
          onDelete={onDelete}
          dragHandleProps={dragHandleProps}
        />
      </div>
    );
  }

  // Truck stops — tractor change marker
  if (stop.type === 'truck') {
    return (
      <div ref={setNodeRef} style={style}>
        <TruckCard
          stop={stop as TruckStop}
          onChange={s => onUpdate(s)}
          onDelete={onDelete}
          dragHandleProps={dragHandleProps}
        />
      </div>
    );
  }

  // From here: stop is SRStop | LHStop | MDCStop
  let trailerMismatch: string | null = null;
  if (stop.type === 'mdc') {
    const mdc = stop as MDCStop;
    if (!mdc.specialActivity && mdc.arrivingWith) {
      for (let i = index - 1; i >= 0; i--) {
        if (allStops[i].type === 'mdc') {
          const prev = allStops[i] as MDCStop;
          if (prev.leavingWith && prev.leavingWith !== mdc.arrivingWith) {
            trailerMismatch = `Prev MDC left with "${prev.leavingWith}" — arriving with "${mdc.arrivingWith}" correct?`;
          }
          break;
        }
      }
    }
  }

  let isOverAllowance = false;
  if (stop.type === 'sr') {
    const sr = stop as SRStop;
    if (sr.arrivalTime !== null && sr.departureTime !== null && sr.departureTime > sr.arrivalTime) {
      isOverAllowance = (sr.departureTime - sr.arrivalTime) > sr.allowanceMinutes;
    }
  } else if (stop.type === 'mdc') {
    const mdc = stop as MDCStop;
    if (mdc.arrivalTime !== null && mdc.departureTime !== null && mdc.departureTime > mdc.arrivalTime) {
      let mdcAllowance = 0;
      if (mdc.specialActivity === 'MDC - additional SR trailer') {
        mdcAllowance = 45;
      } else if (!mdc.specialActivity && mdc.arrivingWith && mdc.leavingWith &&
          !(mdc.arrivingWith === 'Bobtail' && mdc.leavingWith === 'Bobtail')) {
        mdcAllowance = getMDCAllowance(mdc.arrivingWith!, mdc.leavingWith!).total;
      }
      if (mdcAllowance > 0) {
        isOverAllowance = (mdc.departureTime - mdc.arrivalTime) > mdcAllowance;
      }
    }
  }

  let isDuplicate = false;
  if (stop.type === 'sr') {
    const sr = stop as SRStop;
    if (sr.storeCode) {
      isDuplicate = allStops.some((s, j) => j !== index && s.type === 'sr' && (s as SRStop).storeCode === sr.storeCode);
    }
  }

  return (
    <div ref={setNodeRef} style={style}>
      {stop.type === 'mdc' ? (
        <MDCCard stop={stop as MDCStop} index={index} onChange={onUpdate} onDelete={onDelete}
          dragHandleProps={dragHandleProps} trailerMismatch={trailerMismatch} isOverAllowance={isOverAllowance} />
      ) : (
        <StopCard stop={stop as SRStop | LHStop} index={index} onChange={s => onUpdate(s as TripStop)}
          onDelete={onDelete} onPhotoAdd={onPhotoAdd} dragHandleProps={dragHandleProps}
          isOverAllowance={isOverAllowance} isDuplicate={isDuplicate} />
      )}
    </div>
  );
}

export default function TripSheetScreen({ trip, onTripChange, onSubmit, onDiscard }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('trip');
  const [showAddMenu, setShowAddMenu] = useState<{ afterIndex: number } | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  function updateTrip(patch: Partial<TripSheet>) { onTripChange({ ...trip, ...patch }); }

  function updateStop(index: number, updated: TripStop) {
    const stops = [...trip.stops];
    stops[index] = updated;

    // Cascade trailer # forward: SR and MDC changes push to subsequent SR stops until next MDC
    if (updated.type === 'sr' || updated.type === 'mdc') {
      const newTrailer = updated.type === 'sr'
        ? (updated as SRStop).trailerNumber
        : (updated as MDCStop).trailerNumber;
      const oldStop = trip.stops[index];
      const oldTrailer = oldStop.type === 'sr'
        ? (oldStop as SRStop).trailerNumber
        : oldStop.type === 'mdc'
          ? (oldStop as MDCStop).trailerNumber
          : '';
      if (newTrailer !== oldTrailer) {
        for (let i = index + 1; i < stops.length; i++) {
          const s = stops[i];
          if (s.type === 'mdc') break;
          if (s.type === 'lh' || s.type === 'segment' || s.type === 'truck') continue;
          const sr = s as SRStop;
          // MDC defines the whole segment — always overwrite
          // SR change only propagates to matching-or-empty downstream stops
          if (updated.type === 'mdc' || sr.trailerNumber === oldTrailer || sr.trailerNumber === '') {
            stops[i] = { ...sr, trailerNumber: newTrailer };
          }
        }
      }
    }

    updateTrip({ stops });
  }

  function insertStop(afterIndex: number, stop: TripStop) {
    // Only SR stops inherit trailer # from nearest preceding SR or MDC (LH/truck/segment don't)
    if (stop.type === 'sr') {
      for (let i = afterIndex; i >= 0; i--) {
        const s = trip.stops[i];
        if (s.type === 'mdc') {
          const mdcTrailer = (s as MDCStop).trailerNumber;
          if (mdcTrailer) stop = { ...stop, trailerNumber: mdcTrailer } as TripStop;
          break;
        }
        if (s.type === 'segment' || s.type === 'truck' || s.type === 'lh') continue;
        const trailer = (s as SRStop).trailerNumber;
        if (trailer) { stop = { ...stop, trailerNumber: trailer } as TripStop; break; }
      }
    }
    const stops = [...trip.stops]; stops.splice(afterIndex + 1, 0, stop);
    updateTrip({ stops }); setShowAddMenu(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = trip.stops.findIndex(s => s.id === active.id);
    const newIdx = trip.stops.findIndex(s => s.id === over.id);
    if (oldIdx >= 0 && newIdx >= 0) updateTrip({ stops: arrayMove(trip.stops, oldIdx, newIdx) });
  }

  const { stops } = trip;
  const stopCount = stops.filter(s => s.type !== 'segment' && s.type !== 'truck').length;

  return (
    <div className="flex flex-col h-dvh bg-slate-900">
      <div className="flex-shrink-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-base">Route {trip.header.routeNumber}</div>
          <div className="text-slate-400 text-sm">{trip.header.driverName.split(' ')[0]} · {trip.header.dayOfWeek}</div>
        </div>
        <button
          onClick={() => setShowDiscard(true)}
          className="p-2 text-slate-600 hover:text-red-400 transition-colors rounded-lg"
          title="Discard trip"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button onClick={() => updateTrip({ photoCount: trip.photoCount + 1 })}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm transition-colors">
          <Camera className="w-4 h-4 text-slate-400" /><span className="text-slate-300">{trip.photoCount}</span>
        </button>
        <button onClick={() => setShowValidation(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl text-white text-sm font-semibold transition-colors">
          <Send className="w-4 h-4" />Submit
        </button>
      </div>

      <div className="flex-shrink-0 flex border-b border-slate-800 bg-slate-900">
        {(['trip', 'lh'] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-base font-semibold transition-colors border-b-2 ${
              activeTab === tab ? 'text-blue-400 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}>
            {tab === 'trip' ? 'Trip Sheet' : 'LH Requisition'}
          </button>
        ))}
      </div>

      {activeTab === 'trip' && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-4 space-y-3 pb-24">
            <TripHeader header={trip.header} tripId={trip.id} onChange={h => updateTrip({ header: h })} />
            <div className="text-sm text-slate-600 px-1">
              {stopCount} stops · hold to reorder
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={stops.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {stops.map((stop, index) => (
                  <div key={stop.id}>
                    <SortableStop stop={stop} index={index} allStops={stops}
                      onUpdate={u => updateStop(index, u)}
                      onDelete={() => updateTrip({ stops: stops.filter((_, i) => i !== index) })}
                      onPhotoAdd={() => updateTrip({ photoCount: trip.photoCount + 1 })}
                    />
                    <div className="flex items-center justify-center py-0.5">
                      <button type="button"
                        onClick={() => setShowAddMenu(m => m?.afterIndex === index ? null : { afterIndex: index })}
                        className="flex items-center gap-1 text-sm text-slate-700 hover:text-slate-400 transition-colors px-3 py-1 rounded-full hover:bg-slate-800">
                        <Plus className="w-3 h-3" />insert stop
                      </button>
                    </div>
                    {showAddMenu?.afterIndex === index && (
                      <AddStopMenu onAdd={s => insertStop(index, s)} onClose={() => setShowAddMenu(null)} />
                    )}
                  </div>
                ))}
              </SortableContext>
            </DndContext>
            <AddStopMenu onAdd={s => insertStop(stops.length - 1, s)} onClose={() => {}} inline />
          </div>
        </div>
      )}

      {activeTab === 'lh' && (
        <LHRequisitionTab req={trip.lhRequisition} tripHeader={trip.header} onChange={r => updateTrip({ lhRequisition: r })} />
      )}

      {showValidation && (
        <ValidationModal result={validateTrip(trip)} onFix={() => setShowValidation(false)}
          onSubmitAnyway={() => { setShowValidation(false); onSubmit(trip); }} />
      )}

      {/* Discard confirmation */}
      {showDiscard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
            <div className="text-white font-semibold text-lg mb-2">Discard trip sheet?</div>
            <p className="text-slate-400 text-sm mb-6">
              All your entries will be permanently lost and cannot be recovered.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDiscard(false)}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl transition-colors"
              >
                Keep editing
              </button>
              <button
                onClick={onDiscard}
                className="flex-1 py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddStopMenu({ onAdd, onClose, inline = false }: { onAdd: (s: TripStop) => void; onClose: () => void; inline?: boolean; }) {
  if (inline) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => onAdd(makeSRStop('', '', 30, true))}
            className="flex flex-col items-center gap-1.5 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors">
            <MapPin className="w-5 h-5 text-slate-400" /><span className="text-sm text-slate-400">SR Store</span>
          </button>
          <button type="button" onClick={() => onAdd(makeLHStop())}
            className="flex flex-col items-center gap-1.5 py-3 bg-slate-800 hover:bg-slate-700 border border-emerald-900/40 rounded-xl transition-colors">
            <Navigation className="w-5 h-5 text-emerald-600" /><span className="text-sm text-emerald-600">LH Location</span>
          </button>
          <button type="button" onClick={() => onAdd(makeMDCStop())}
            className="flex flex-col items-center gap-1.5 py-3 bg-slate-800 hover:bg-slate-700 border border-blue-900/40 rounded-xl transition-colors">
            <Building2 className="w-5 h-5 text-blue-600" /><span className="text-sm text-blue-600">MDC Stop</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onAdd(makeSegmentStop())}
            className="flex flex-col items-center gap-1.5 py-3 bg-slate-800/30 hover:bg-slate-800 border border-yellow-700/50 rounded-xl transition-colors text-yellow-700 hover:text-yellow-600">
            <Flag className="w-5 h-5" />
            <span className="text-sm text-center">New route number</span>
          </button>
          <button type="button" onClick={() => onAdd(makeTruckStop())}
            className="flex flex-col items-center gap-1.5 py-3 bg-slate-800/30 hover:bg-slate-800 border border-yellow-700/50 rounded-xl transition-colors text-yellow-700 hover:text-yellow-600">
            <Truck className="w-5 h-5" />
            <span className="text-sm text-center">New truck</span>
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 border-b border-slate-700">Insert stop</div>
      <div className="p-2 space-y-1">
        <button type="button" onClick={() => { onAdd(makeSRStop('', '', 30, true)); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-700 rounded-lg transition-colors text-left">
          <MapPin className="w-4 h-4 text-slate-400" />SR Store (off-day call / same-day special)
        </button>
        <button type="button" onClick={() => { onAdd(makeLHStop()); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-emerald-400 hover:bg-slate-700 rounded-lg transition-colors text-left">
          <Navigation className="w-4 h-4" />LH Location (free text)
        </button>
        <button type="button" onClick={() => { onAdd(makeMDCStop()); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-blue-400 hover:bg-slate-700 rounded-lg transition-colors text-left">
          <Building2 className="w-4 h-4" />MDC Stop
        </button>
        <button type="button" onClick={() => { onAdd(makeSpecialMDCStop('MDC - additional SR trailer')); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-purple-400 hover:bg-slate-700 rounded-lg transition-colors text-left">
          <Building2 className="w-4 h-4" />MDC - Additional SR trailer
        </button>
        <button type="button" onClick={() => { onAdd(makeSegmentStop()); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-yellow-700 hover:bg-slate-700 rounded-lg transition-colors text-left border-t border-slate-700 mt-1 pt-2">
          <Flag className="w-4 h-4" />New route number
        </button>
        <button type="button" onClick={() => { onAdd(makeTruckStop()); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-yellow-700 hover:bg-slate-700 rounded-lg transition-colors text-left">
          <Truck className="w-4 h-4" />New truck
        </button>
      </div>
    </div>
  );
}
