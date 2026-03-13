"use client";

import React from 'react';

interface WorldTabProps {
    editableName: string;
    onNameChange: (val: string) => void;
    description: string;
    geography: string;
    timePeriod: string;
    technologyLevel: string;
    atmosphere: string;
    visualTraits: string;
    colorPalette: string;
    lighting: string;
    texture: string;
    moodAtmosphere: string;
    onChange: (key: string, value: string) => void;
}

const Field = ({ label, value, onChange, multiline = false }: {
    label: string; value: string; onChange: (v: string) => void; multiline?: boolean;
}) => (
    <div className="flex flex-col gap-1">
        <label className="text-[9px] text-neutral-500 font-bold tracking-widest uppercase">{label}</label>
        {multiline ? (
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={3}
                className="bg-white/[0.03] border border-white/[0.08] rounded px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/20 transition-colors resize-none"
            />
        ) : (
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="bg-white/[0.03] border border-white/[0.08] rounded px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/20 transition-colors"
            />
        )}
    </div>
);

export const WorldTab: React.FC<WorldTabProps> = ({
    editableName,
    onNameChange,
    description,
    geography,
    timePeriod,
    technologyLevel,
    atmosphere,
    visualTraits,
    colorPalette,
    lighting,
    texture,
    moodAtmosphere,
    onChange,
}) => {
    return (
        <div className="flex flex-col gap-5">
            {/* Name */}
            <Field label="World Name" value={editableName} onChange={onNameChange} />

            {/* Description */}
            <Field label="Description" value={description} onChange={(v) => onChange('description', v)} multiline />

            {/* Core Identity */}
            <div className="grid grid-cols-2 gap-4">
                <Field label="Geography" value={geography} onChange={(v) => onChange('geography', v)} />
                <Field label="Atmosphere" value={atmosphere} onChange={(v) => onChange('atmosphere', v)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Field label="Time Period" value={timePeriod} onChange={(v) => onChange('time_period', v)} />
                <Field label="Technology Level" value={technologyLevel} onChange={(v) => onChange('technology_level', v)} />
            </div>

            {/* Visual Traits */}
            <Field label="Visual Traits (comma-separated)" value={visualTraits} onChange={(v) => onChange('visual_traits', v)} />

            {/* Moodboard Style */}
            <div className="mt-2">
                <div className="text-[9px] text-neutral-500 font-bold tracking-widest uppercase mb-3">Moodboard Style</div>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Color Palette" value={colorPalette} onChange={(v) => onChange('color_palette', v)} />
                    <Field label="Lighting" value={lighting} onChange={(v) => onChange('mood_lighting', v)} />
                    <Field label="Texture" value={texture} onChange={(v) => onChange('texture', v)} />
                    <Field label="Mood Atmosphere" value={moodAtmosphere} onChange={(v) => onChange('mood_atmosphere', v)} />
                </div>
            </div>
        </div>
    );
};
