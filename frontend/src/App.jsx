import React, { useState, useCallback, useEffect } from 'react';
import heic2any from 'heic2any';
import { translations, languages } from './i18n';

const API_URL = '/api';

const CameraIcon = () => (<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>);
const LoaderIcon = () => (<svg style={{animation: 'spin 1s linear infinite', marginRight: 8}} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>);
const SparklesIcon = () => (<svg style={{marginRight: 8}} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>);
const CopyIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>);
const CheckIcon = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#09B1BA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>);
const RefreshIcon = () => (<svg style={{marginRight: 8}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>);

export default function App() {
    const [images, setImages] = useState([]);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState({});
    const [hints, setHints] = useState('');
    const [reviseInstruction, setReviseInstruction] = useState('');
    const [isRevising, setIsRevising] = useState(false);
    const [language, setLanguage] = useState(() => {
        return localStorage.getItem('vintedLang') || 'de';
    });

    useEffect(() => {
        localStorage.setItem('vintedLang', language);
    }, [language]);

    const t = translations[language] || translations['en'];

    const handleUpload = useCallback(async (e) => {
        const selectedFiles = Array.from(e.target.files || e.dataTransfer?.files || []);
        
        if (e.target && e.target.type === 'file') {
            e.target.value = '';
        }

        if (selectedFiles.length === 0) return;
        
        setLoading(true);
        setError(null);

        try {
            const processedFiles = [...files];
            const processedImages = [...images];

            for (let f of selectedFiles) {
                const isHeic = f.type === 'image/heic' || f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif');
                if (!f.type.startsWith('image/') && !isHeic) continue;

                if (isHeic) {
                    const convertedBlob = await heic2any({
                        blob: f,
                        toType: 'image/jpeg',
                        quality: 0.8
                    });
                    const singleBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                    const newFile = new File([singleBlob], f.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), { type: 'image/jpeg' });
                    processedFiles.push(newFile);
                    processedImages.push(URL.createObjectURL(newFile));
                } else {
                    processedFiles.push(f);
                    processedImages.push(URL.createObjectURL(f));
                }
            }

            setFiles(processedFiles);
            setImages(processedImages);
            if (processedFiles.length > 0) {
                setResult(null);
            }
        } catch (err) {
            console.error("Bildverarbeitung fehlgeschlagen:", err);
            setError("Fehler bei der Bildverarbeitung.");
        } finally {
            setLoading(false);
        }
    }, [files, images]);

    const analyze = async () => {
        if (files.length === 0) return;
        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            files.forEach(f => formData.append('files', f));
            if (hints.trim()) {
                formData.append('hints', hints.trim());
            }
            formData.append('lang', language);

            const res = await fetch(`${API_URL}/analyze`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || `HTTP ${res.status}`);
            }

            const data = await res.json();
            if (data.error) {
                throw new Error(data.error);
            }
            if (data.is_vinted_item === false) {
                throw new Error(data.rejection_reason || "Dieses Bild zeigt scheinbar keinen für Vinted geeigneten Artikel. Bitte lade ein neues Bild hoch.");
            }

            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const improve = async (style) => {
        if (!result?.beschreibung) return;
        try {
            const res = await fetch(`${API_URL}/improve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: result.beschreibung,
                    style: style,
                    lang: language
                }),
            });

            const data = await res.json();
            if (data.improved) {
                setResult({ ...result, beschreibung: data.improved });
            }
        } catch (err) {
            console.error('Improve failed:', err);
        }
    };

    const handleRevise = async () => {
        if (!reviseInstruction.trim() || !result) return;
        setIsRevising(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/revise`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_listing: result,
                    instruction: reviseInstruction.trim(),
                    lang: language
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || `HTTP ${res.status}`);
            }

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setResult(data);
            setReviseInstruction('');
        } catch (err) {
            setError(err.message);
        } finally {
            setIsRevising(false);
        }
    };

    const handleLanguageChange = async (e) => {
        const newLang = e.target.value;
        setLanguage(newLang);
        
        if (result && !loading && !isRevising) {
            setIsRevising(true);
            setError(null);
            try {
                const res = await fetch(`${API_URL}/revise`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        current_listing: result,
                        instruction: "Übersetze dieses komplette Vinted-Listing rigoros in diese Sprache! ALLE Werte (Kategorie, Marke, Größe, Farbe, Zustand, Titel, Beschreibung, Hashtags) müssen übersetzt werden. Lasse NICHTS aus! Das JSON Format und die Keys (z.B. 'titel' bleibt 'titel') müssen exakt so bleiben.",
                        lang: newLang
                    }),
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || `HTTP ${res.status}`);
                }

                const data = await res.json();
                if (data.error) throw new Error(data.error);

                setResult(data);
            } catch (err) {
                console.error("Auto-translation failed:", err);
                setError("Fehler bei der automatischen Übersetzung. Bitte klicke auf 'Listing generieren'.");
            } finally {
                setIsRevising(false);
            }
        }
    };

    const copy = (key, text) => {
        navigator.clipboard.writeText(text);
        setCopied({ [key]: true });
        setTimeout(() => setCopied({}), 2000);
    };

    const reset = () => {
        setImages([]);
        setFiles([]);
        setResult(null);
        setError(null);
        setHints('');
        setReviseInstruction('');
        const fileInput = document.getElementById('file');
        if (fileInput) fileInput.value = '';
    };

    return (
        <div style={styles.page}>
            <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
                body { margin: 0; background-color: #f8fafc; color: #0f172a; font-family: 'Inter', system-ui, sans-serif; }
                * { box-sizing: border-box; }
                .btn-hover:hover { opacity: 0.9; transform: translateY(-1px); }
                .btn-hover { transition: all 0.2s; }
            `}</style>
            
            <div style={styles.container}>
                <header style={styles.header}>
                    <div style={styles.headerTop}>
                        <h1 style={styles.title}>{t.appTitle}</h1>
                        <select 
                            value={language}
                            onChange={handleLanguageChange}
                            style={styles.langSelect}
                            disabled={isRevising || loading}
                        >
                            {languages.map(lng => (
                                <option key={lng.code} value={lng.code}>{lng.name}</option>
                            ))}
                        </select>
                    </div>
                    <p style={styles.subtitle}>{t.appSubtitle}</p>
                </header>

                <div
                    style={{
                        ...styles.upload,
                        borderColor: images.length > 0 ? '#09B1BA' : '#e2e8f0',
                        backgroundColor: images.length > 0 ? '#ffffff' : '#f8fafc',
                    }}
                    onDrop={(e) => { e.preventDefault(); handleUpload(e); }}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => document.getElementById('file').click()}
                >
                    <input
                        id="file"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleUpload}
                        style={{ display: 'none' }}
                    />
                    {images.length > 0 ? (
                        <div style={styles.imageGrid}>
                            {images.map((img, i) => (
                                <img key={i} src={img} alt={`Preview ${i}`} style={styles.previewLarge} />
                            ))}
                        </div>
                    ) : (
                        <div style={styles.placeholder}>
                            {loading ? <LoaderIcon /> : <CameraIcon />}
                            <p style={styles.placeholderText}>
                                {loading ? t.uploading : t.uploadPlaceholder}
                            </p>
                        </div>
                    )}
                </div>

                {images.length > 0 && (
                    <div style={styles.hintsWrapper}>
                        <textarea 
                            style={{...styles.hintsInput, borderColor: hints ? '#09B1BA' : '#e2e8f0'}}
                            placeholder={t.hintsPlaceholder}
                            value={hints}
                            onChange={(e) => setHints(e.target.value)}
                            disabled={loading || !!result}
                        />
                    </div>
                )}

                {images.length > 0 && !result && (
                    <button 
                        onClick={analyze} 
                        disabled={loading} 
                        style={{...styles.btn, opacity: loading ? 0.7 : 1}}
                        className="btn-hover"
                    >
                        <div style={styles.btnContent}>
                            {loading ? <LoaderIcon /> : <SparklesIcon />}
                            {loading ? t.btnAnalyzing : t.btnAnalyze}
                        </div>
                    </button>
                )}

                {error && <div style={styles.error}>{error}</div>}

                {result && (
                    <div style={{ ...styles.results, position: 'relative' }}>
                        {isRevising && (
                            <div style={styles.loadingOverlay}>
                                <LoaderIcon />
                                <span>{t.btnRevising}</span>
                            </div>
                        )}
                        {result.ignored_images_notice && (
                            <div style={styles.warningBanner}>
                                ⚠️ {result.ignored_images_notice}
                            </div>
                        )}
                        <div style={styles.resultsHeader}>
                            <h2 style={styles.resultsTitle}>{t.resultsTitle}</h2>
                        </div>

                        <Field
                            label="Titel"
                            value={result.titel}
                            onCopy={() => copy('titel', result.titel)}
                            copied={copied.titel}
                        />

                        <Field
                            label="Beschreibung"
                            value={result.beschreibung}
                            onCopy={() => copy('beschreibung', result.beschreibung)}
                            copied={copied.beschreibung}
                            multiline
                        />

                        <div style={styles.improveRow}>
                            <button onClick={() => improve('shorter')} style={styles.smallBtn} className="btn-hover">{t.btnShorter}</button>
                            <button onClick={() => improve('longer')} style={styles.smallBtn} className="btn-hover">{t.btnLonger}</button>
                            <button onClick={() => improve('emotional')} style={styles.smallBtn} className="btn-hover">{t.btnEmotional}</button>
                            <button onClick={() => improve('professional')} style={styles.smallBtn} className="btn-hover">{t.btnProfessional}</button>
                        </div>

                        <div style={styles.grid}>
                            <Field label={t.categoryLabel} value={
                                typeof result.kategorie === 'object'
                                    ? `${result.kategorie.hauptkategorie} > ${result.kategorie.unterkategorie}`
                                    : result.kategorie
                            } small />
                            <Field label={t.brandLabel} value={result.marke} small />
                            <Field label={t.sizeLabel} value={result.groesse} small />
                            <Field label={t.conditionLabel} value={result.zustand} small />
                            <Field label={t.colorLabel} value={result.farbe} small />
                            <Field label={t.materialLabel} value={result.material || '-'} small />
                        </div>

                        <div style={styles.priceBox}>
                            <div style={styles.priceLabel}>{t.priceRec}</div>
                            {typeof result.preis === 'object' ? (
                                <>
                                    <div style={styles.priceMain}>{result.preis.empfohlen} €</div>
                                    <div style={styles.priceRange}>
                                        {t.priceFast}: {result.preis.schnell_verkaufen}€ &middot; {t.priceMax}: {result.preis.maximum}€
                                    </div>
                                </>
                            ) : (
                                <div style={styles.priceMain}>{result.preis} €</div>
                            )}
                        </div>

                        <Field
                            label={t.hashtagsLabel}
                            value={result.hashtags}
                            onCopy={() => copy('hashtags', result.hashtags)}
                            copied={copied.hashtags}
                        />

                        <div style={styles.reviseWrapper}>
                            <h3 style={styles.reviseTitle}>{t.reviseTitle}</h3>
                            <textarea
                                style={styles.reviseInput}
                                placeholder={t.revisePlaceholder}
                                value={reviseInstruction}
                                onChange={(e) => setReviseInstruction(e.target.value)}
                                disabled={isRevising}
                            />
                            <button 
                                onClick={handleRevise} 
                                style={{...styles.reviseBtn, opacity: isRevising || !reviseInstruction.trim() ? 0.7 : 1}} 
                                disabled={isRevising || !reviseInstruction.trim()}
                                className="btn-hover"
                            >
                                {isRevising ? <LoaderIcon /> : <SparklesIcon />}
                                {isRevising ? t.btnRevising : t.btnRevise}
                            </button>
                        </div>

                        <button onClick={reset} style={styles.resetBtn} className="btn-hover">
                            <RefreshIcon /> {t.btnReset}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function Field({ label, value, onCopy, copied, multiline, small }) {
    return (
        <div style={small ? styles.fieldSmall : styles.field}>
            <div style={styles.fieldHeader}>
                <span style={styles.fieldLabel}>{label}</span>
                {onCopy && (
                    <button onClick={onCopy} style={styles.copyBtn} aria-label="Kopieren">
                        {copied ? <CheckIcon /> : <CopyIcon />}
                    </button>
                )}
            </div>
            <div style={multiline ? { ...styles.fieldValue, whiteSpace: 'pre-wrap' } : styles.fieldValue}>
                {value}
            </div>
        </div>
    );
}

const styles = {
    page: {
        minHeight: '100vh',
        padding: '40px 20px',
        display: 'flex',
        justifyContent: 'center',
    },
    container: {
        width: '100%',
        maxWidth: 640,
        backgroundColor: '#ffffff',
        borderRadius: 20,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.04)',
        padding: 40,
    },
    header: {
        marginBottom: 32,
    },
    headerTop: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    langSelect: {
        padding: '6px 12px',
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
        fontSize: 14,
        color: '#0f172a',
        outline: 'none',
        cursor: 'pointer',
    },
    title: {
        fontSize: 24,
        fontWeight: 700,
        color: '#0f172a',
        margin: 0,
        letterSpacing: '-0.02em',
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 6,
    },
    upload: {
        border: '2px dashed #e2e8f0',
        borderRadius: 16,
        padding: 40,
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 220,
    },
    placeholder: {
        color: '#94a3b8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
    },
    placeholderText: {
        margin: 0,
        fontSize: 14,
        fontWeight: 500,
    },
    hintsWrapper: {
        marginTop: 20,
    },
    hintsInput: {
        width: '100%',
        minHeight: 100,
        padding: 16,
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        fontSize: 14,
        color: '#0f172a',
        fontFamily: 'inherit',
        resize: 'vertical',
        outline: 'none',
        transition: 'all 0.2s ease',
    },
    imageGrid: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'center',
    },
    previewLarge: {
        width: '100%',
        maxWidth: 320,
        height: 'auto',
        maxHeight: 320,
        objectFit: 'contain',
        borderRadius: 16,
        border: '3px solid #e2e8f0',
        boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    },
    warningBanner: {
        backgroundColor: '#fffbeb',
        color: '#b45309',
        padding: 16,
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 500,
        marginBottom: 20,
        lineHeight: 1.5,
    },
    btn: {
        width: '100%',
        padding: '16px 24px',
        marginTop: 20,
        fontSize: 15,
        fontWeight: 600,
        backgroundColor: '#09B1BA',
        color: 'white',
        border: 'none',
        borderRadius: 12,
        cursor: 'pointer',
    },
    btnContent: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    error: {
        marginTop: 20,
        padding: 14,
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 12,
        color: '#b91c1c',
        fontSize: 14,
        fontWeight: 500,
    },
    results: {
        marginTop: 32,
        paddingTop: 32,
        borderTop: '1px solid #f1f5f9',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0, left: -20, right: -20, bottom: -40,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        fontWeight: 600,
        color: '#09B1BA',
        backdropFilter: 'blur(3px)',
        borderRadius: 12,
    },
    resultsHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    resultsTitle: {
        margin: 0,
        fontSize: 18,
        fontWeight: 600,
        color: '#0f172a',
    },
    copyAllBtn: {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 500,
        color: '#0f172a',
        backgroundColor: '#f1f5f9',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
    },
    field: {
        marginBottom: 16,
        padding: 16,
        backgroundColor: '#f8fafc',
        border: '1px solid #f1f5f9',
        borderRadius: 12,
    },
    fieldSmall: {
        padding: 12,
        backgroundColor: '#f8fafc',
        border: '1px solid #f1f5f9',
        borderRadius: 10,
    },
    fieldHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    fieldLabel: {
        fontSize: 11,
        fontWeight: 600,
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    fieldValue: {
        fontSize: 14,
        color: '#1e293b',
        lineHeight: 1.6,
    },
    copyBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 6,
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        cursor: 'pointer',
        color: '#64748b',
    },
    improveRow: {
        display: 'flex',
        gap: 8,
        marginBottom: 16,
        flexWrap: 'wrap',
    },
    smallBtn: {
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: 500,
        color: '#475569',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        cursor: 'pointer',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        marginBottom: 16,
    },
    priceBox: {
        padding: 24,
        backgroundColor: '#f0fdfd',
        borderRadius: 16,
        textAlign: 'center',
        marginBottom: 16,
        border: '1px solid #ccfbfb',
    },
    priceLabel: {
        fontSize: 12,
        fontWeight: 600,
        color: '#007782',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    priceMain: {
        fontSize: 36,
        fontWeight: 700,
        color: '#09B1BA',
        letterSpacing: '-0.02em',
    },
    priceRange: {
        fontSize: 13,
        color: '#007782',
        marginTop: 8,
        opacity: 0.8,
    },
    resetBtn: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        fontSize: 14,
        fontWeight: 500,
        color: '#0f172a',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        cursor: 'pointer',
    },
    reviseWrapper: {
        marginTop: 24,
        paddingTop: 24,
        borderTop: '1px solid #f1f5f9',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginBottom: 24,
    },
    reviseTitle: {
        margin: 0,
        fontSize: 15,
        fontWeight: 600,
        color: '#0f172a',
    },
    reviseInput: {
        width: '100%',
        minHeight: 80,
        padding: 14,
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
        fontSize: 14,
        color: '#0f172a',
        fontFamily: 'inherit',
        resize: 'vertical',
        outline: 'none',
        transition: 'all 0.2s ease',
    },
    reviseBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 20px',
        fontSize: 14,
        fontWeight: 600,
        backgroundColor: '#0f172a',
        color: '#ffffff',
        border: 'none',
        borderRadius: 10,
        cursor: 'pointer',
    },
};