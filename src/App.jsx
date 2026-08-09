import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCloudRecipeBook } from './cloudStorage.js';

const initialRecipes = [
  {
    id: '1',
    title: 'Паста карбонара',
    category: 'Ужин',
    time: '25 мин',
    difficulty: 'Легко',
    favorite: true,
    image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1200&q=80',
    ingredients: ['200 г пасты', '100 г бекона', '2 яйца', '50 г пармезана', 'Чёрный перец'],
    steps: ['Отвари пасту до состояния al dente.', 'Обжарь бекон до золотистости.', 'Смешай яйца с тёртым пармезаном.', 'Соедини пасту, бекон и соус, быстро перемешай.', 'Подавай с чёрным перцем.'],
    note: 'Один из самых уютных рецептов для быстрого ужина.',
    author: 'Семейный рецепт',
    tag: 'Классика',
  },
  {
    id: '2',
    title: 'Сырники',
    category: 'Завтрак',
    time: '20 мин',
    difficulty: 'Легко',
    favorite: false,
    image: 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&w=1200&q=80',
    ingredients: ['400 г творога', '1 яйцо', '2 ст. л. сахара', '3 ст. л. муки', 'Ваниль'],
    steps: ['Смешай творог, яйцо, сахар и ваниль.', 'Добавь муку и сформируй небольшие сырники.', 'Обжарь с двух сторон до румяной корочки.', 'Подавай со сметаной, мёдом или ягодами.'],
    note: 'Идеально для ленивого выходного утра.',
    author: 'Любимый завтрак',
    tag: 'Уют',
  },
  {
    id: '3',
    title: 'Шоколадный брауни',
    category: 'Десерт',
    time: '40 мин',
    difficulty: 'Средне',
    favorite: true,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=1200&q=80',
    ingredients: ['180 г шоколада', '120 г масла', '2 яйца', '120 г сахара', '90 г муки'],
    steps: ['Растопи шоколад с маслом.', 'Взбей яйца с сахаром.', 'Смешай всё вместе, добавь муку.', 'Выпекай около 25 минут при 175°C.', 'Дай остыть перед нарезкой.'],
    note: 'Для случаев, когда нужен быстрый вкусный десерт.',
    author: 'На праздник',
    tag: 'Шоколад',
  },
  {
    id: '4',
    title: 'Томатный суп',
    category: 'Обед',
    time: '35 мин',
    difficulty: 'Легко',
    favorite: false,
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80',
    ingredients: ['Томаты', 'Лук', 'Чеснок', 'Сливки', 'Базилик'],
    steps: ['Обжарь лук и чеснок.', 'Добавь томаты и немного воды.', 'Провари до мягкости.', 'Измельчи блендером и добавь сливки.', 'Укрась базиликом.'],
    note: 'Тёплый, домашний и очень простой.',
    author: 'Для прохладных дней',
    tag: 'Комфорт',
  },
];

const defaultCategories = ['Завтрак', 'Обед', 'Ужин', 'Десерт'];
const FALLBACK_CATEGORY = 'Без категории';
const DEFAULT_RECIPE_IMAGE = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80';

function cls(...arr) {
  return arr.filter(Boolean).join(' ');
}

const iconMap = {
  heart: '♥',
  search: '⌕',
  bookmark: '▰',
  book: '📖',
  camera: '📷',
  plus: '+',
  star: '★',
  filter: '☰',
  close: '×',
  upload: '⇧',
  folder: '▣',
  home: '⌂',
  sparkles: '✦',
  scroll: '☷',
};

function Icon({ name, className = '' }) {
  return (
    <span aria-hidden="true" className={cls('inline-flex items-center justify-center leading-none', className)}>
      {iconMap[name] || '•'}
    </span>
  );
}

function normalizeLines(value) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function linesToText(lines) {
  return Array.isArray(lines) ? lines.join('\n') : '';
}

function ensureUniqueCategories(baseCategories, recipes) {
  const used = recipes.map((recipe) => recipe.category).filter(Boolean);
  return Array.from(new Set([...baseCategories, ...used]));
}

function installPWA() {
  alert('Чтобы установить как приложение: открой сайт в браузере Chrome или Safari и выбери «Добавить на главный экран».');
}

function Ribbon({ label, active, onClick, colorClass = 'bg-rose-600' }) {
  return (
    <button
      onClick={onClick}
      className={cls(
        'relative min-w-[132px] rounded-t-2xl px-4 py-3 text-left text-sm font-semibold text-white shadow-lg transition-all',
        colorClass,
        active ? 'translate-y-0' : 'translate-y-3 opacity-85 hover:translate-y-1',
      )}
    >
      <span>{label}</span>
      <span className="absolute -bottom-3 left-0 border-l-[16px] border-l-transparent border-t-[12px] border-t-black/20" />
      <span className="absolute -bottom-3 right-0 border-r-[16px] border-r-transparent border-t-[12px] border-t-black/20" />
    </button>
  );
}

function RecipeCard({ recipe, onOpen, onToggleFavorite, onEdit, onDelete }) {
  return (
    <div className="space-y-3">
      <motion.article
        layout
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -18 }}
        className="group overflow-hidden rounded-[28px] border border-amber-100 bg-[#fffaf0] shadow-lg shadow-amber-100/50"
      >
        <div className="relative">
          <img src={recipe.image} alt={recipe.title} className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          <button
            onClick={() => onToggleFavorite(recipe.id)}
            className="absolute right-4 top-4 rounded-full bg-white/90 p-2 shadow"
            aria-label="Переключить избранное"
          >
            <Icon name="heart" className={cls('h-5 w-5 text-lg', recipe.favorite ? 'text-rose-500' : 'text-slate-500')} />
          </button>
          <div className="absolute left-4 top-4 rounded-full bg-[#5d4037]/90 px-3 py-1 text-xs font-medium text-amber-50">{recipe.tag}</div>
        </div>

        <div className="p-5">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">{recipe.category}</span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">{recipe.time}</span>
            <span className="rounded-full bg-stone-200 px-3 py-1 text-stone-700">{recipe.difficulty}</span>
          </div>
          <h3 className="text-2xl font-semibold text-stone-800">{recipe.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-stone-600">{recipe.note}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-stone-500">{recipe.author}</p>
            <button onClick={() => onOpen(recipe)} className="rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-700">
              Открыть
            </button>
          </div>
        </div>
      </motion.article>

      <div className="flex gap-2 px-1">
        <button onClick={() => onEdit(recipe)} className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm text-stone-700">
          Редактировать
        </button>
        <button onClick={() => onDelete(recipe)} className="rounded-full bg-rose-100 px-4 py-2 text-sm text-rose-700">
          Удалить
        </button>
      </div>
    </div>
  );
}

function RecipeModal({ recipe, onClose, onToggleFavorite }) {
  if (!recipe) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          className="relative max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[32px] bg-[#fdf7ea] shadow-2xl"
        >
          <button onClick={onClose} className="absolute right-4 top-4 z-10 rounded-full bg-white p-2 shadow">
            <Icon name="close" className="h-5 w-5 text-xl" />
          </button>

          <div className="grid max-h-[92vh] overflow-auto md:grid-cols-[1.05fr_1fr]">
            <div className="relative min-h-[320px]">
              <img src={recipe.image} alt={recipe.title} className="h-full w-full object-cover" />
              <div className="absolute bottom-4 left-4 rounded-2xl bg-white/90 px-4 py-3 shadow">
                <p className="text-xs uppercase tracking-[0.25em] text-stone-500">Глава</p>
                <p className="text-lg font-semibold text-stone-800">{recipe.category}</p>
              </div>
            </div>

            <div className="relative border-l border-amber-200 bg-[linear-gradient(to_right,transparent_0,transparent_28px,#eadfbe_28px,#eadfbe_30px,transparent_30px)] p-8">
              <div className="absolute bottom-0 right-8 top-0 w-[2px] bg-amber-100" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-700">{recipe.time}</span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">{recipe.difficulty}</span>
                <button onClick={() => onToggleFavorite(recipe.id)} className="rounded-full bg-white px-3 py-1 text-xs shadow">
                  {recipe.favorite ? '★ В избранном' : '☆ В избранное'}
                </button>
              </div>

              <h2 className="mt-4 text-4xl font-bold leading-tight text-stone-800">{recipe.title}</h2>
              <p className="mt-3 text-stone-600">{recipe.note}</p>

              <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-stone-800">
                    <Icon name="scroll" className="h-5 w-5" /> Ингредиенты
                  </h3>
                  <ul className="space-y-2 text-stone-700">
                    {recipe.ingredients.map((item, idx) => (
                      <li key={idx} className="rounded-2xl bg-white/80 px-4 py-3 shadow-sm">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-stone-800">
                    <Icon name="book" className="h-5 w-5" /> Приготовление
                  </h3>
                  <ol className="space-y-3 text-stone-700">
                    {recipe.steps.map((step, idx) => (
                      <li key={idx} className="flex gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-sm">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-800 text-sm font-semibold text-white">
                          {idx + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function resizeRecipeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
    reader.onload = () => {
      const source = new Image();
      source.onerror = () => reject(new Error('Не удалось открыть изображение.'));
      source.onload = () => {
        const maxSide = 1200;
        const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
        const canvas = document.createElement('canvas');
        let currentScale = scale;
        let result = '';
        while (currentScale >= 0.28) {
          canvas.width = Math.max(1, Math.round(source.width * currentScale));
          canvas.height = Math.max(1, Math.round(source.height * currentScale));
          canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL('image/jpeg', currentScale > 0.6 ? 0.78 : 0.68);
          if (result.length <= 520_000) break;
          currentScale *= 0.8;
        }
        resolve(result);
      };
      source.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function RecipeEditorModal({ open, onClose, onSave, categoryOptions, initialRecipe = null, mode = 'add' }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(categoryOptions[0] || FALLBACK_CATEGORY);
  const [time, setTime] = useState('30 мин');
  const [difficulty, setDifficulty] = useState('Легко');
  const [ingredients, setIngredients] = useState('');
  const [steps, setSteps] = useState('');
  const [note, setNote] = useState('');
  const [author, setAuthor] = useState('Новый рецепт');
  const [tag, setTag] = useState('Новинка');
  const [image, setImage] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (initialRecipe) {
      setTitle(initialRecipe.title || '');
      setCategory(initialRecipe.category || categoryOptions[0] || FALLBACK_CATEGORY);
      setTime(initialRecipe.time || '30 мин');
      setDifficulty(initialRecipe.difficulty || 'Легко');
      setIngredients(linesToText(initialRecipe.ingredients || []));
      setSteps(linesToText(initialRecipe.steps || []));
      setNote(initialRecipe.note || '');
      setAuthor(initialRecipe.author || 'Новый рецепт');
      setTag(initialRecipe.tag || 'Новинка');
      setImage(initialRecipe.image || '');
      return;
    }
    setTitle('');
    setCategory(categoryOptions[0] || FALLBACK_CATEGORY);
    setTime('30 мин');
    setDifficulty('Легко');
    setIngredients('');
    setSteps('');
    setNote('');
    setAuthor('Новый рецепт');
    setTag('Новинка');
    setImage('');
  }, [open, initialRecipe, categoryOptions]);

  if (!open) return null;

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageBusy(true);
    setImageError('');
    try {
      setImage(await resizeRecipeImage(file));
    } catch (error) {
      setImageError(error.message);
    } finally {
      setImageBusy(false);
    }
  };

  const submit = () => {
    if (!title.trim()) return;
    onSave({
      id: initialRecipe?.id || crypto.randomUUID(),
      createdAt: initialRecipe?.createdAt || Date.now(),
      title: title.trim(),
      category: category || FALLBACK_CATEGORY,
      time,
      difficulty,
      ingredients: normalizeLines(ingredients),
      steps: normalizeLines(steps),
      note: note.trim(),
      author: author.trim() || 'Новый рецепт',
      tag: tag.trim() || 'Новинка',
      image: image || DEFAULT_RECIPE_IMAGE,
      favorite: initialRecipe?.favorite || false,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[94vh] w-full max-w-3xl overflow-auto rounded-[32px] bg-[#fdf7ea] p-6 shadow-2xl md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-stone-500">{mode === 'edit' ? 'Редактирование страницы' : 'Новая страница'}</p>
            <h2 className="text-3xl font-bold text-stone-800">{mode === 'edit' ? 'Редактировать рецепт' : 'Добавить рецепт'}</h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-white p-2 shadow">
            <Icon name="close" className="h-5 w-5 text-xl" />
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название рецепта" className="rounded-2xl border border-amber-200 bg-white px-4 py-3 outline-none" />
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Автор / заметка" className="rounded-2xl border border-amber-200 bg-white px-4 py-3 outline-none" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-2xl border border-amber-200 bg-white px-4 py-3 outline-none">
            {categoryOptions.map((cat) => (
              <option key={cat}>{cat}</option>
            ))}
          </select>
          <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="Время" className="rounded-2xl border border-amber-200 bg-white px-4 py-3 outline-none" />
          <input value={difficulty} onChange={(e) => setDifficulty(e.target.value)} placeholder="Сложность" className="rounded-2xl border border-amber-200 bg-white px-4 py-3 outline-none" />
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Короткий тег" className="rounded-2xl border border-amber-200 bg-white px-4 py-3 outline-none" />
        </div>

        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Описание, история или личная заметка" className="mt-4 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 outline-none" />
        <textarea value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={6} placeholder="Ингредиенты: каждый с новой строки" className="mt-4 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 outline-none" />
        <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={6} placeholder="Шаги приготовления: каждый с новой строки" className="mt-4 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 outline-none" />

        <div className="mt-4 rounded-[28px] border border-dashed border-amber-300 bg-white/70 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="font-semibold text-stone-800">Фото рецепта</h3>
              <p className="text-sm text-stone-500">Можно вставить картинку файлом с устройства.</p>
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-full bg-stone-800 px-4 py-2 text-sm font-medium text-white">
              <Icon name="upload" className="h-4 w-4" /> {imageBusy ? 'Подготавливаем…' : 'Загрузить фото'}
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          {imageError ? <p className="mt-3 text-sm text-rose-700">{imageError}</p> : null}
          {image ? <img src={image} alt="preview" className="mt-4 h-52 w-full rounded-2xl object-cover" /> : null}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button onClick={onClose} className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-stone-700">
            Отмена
          </button>
          <button onClick={submit} className="rounded-full bg-rose-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-rose-200">
            {mode === 'edit' ? 'Сохранить изменения' : 'Сохранить рецепт'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthModal({ open, onClose, onSignIn, onSignUp, onResetPassword }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'signup') await onSignUp(email.trim(), password);
      else await onSignIn(email.trim(), password);
      onClose();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) {
      setMessage('Сначала введите email.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await onResetPassword(email.trim());
      setMessage('Письмо для восстановления пароля отправлено.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-[32px] bg-[#fdf7ea] p-7 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Облачная книга</p>
            <h2 className="mt-1 text-3xl font-bold text-stone-800">{mode === 'signup' ? 'Создать аккаунт' : 'Войти'}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white p-2 shadow"><Icon name="close" className="h-5 w-5 text-xl" /></button>
        </div>
        <p className="mt-4 text-sm leading-6 text-stone-600">Используйте один и тот же email и пароль на телефоне, планшете и компьютере.</p>
        <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="mt-5 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 outline-none" />
        <input type="password" required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Пароль (минимум 6 символов)" className="mt-3 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 outline-none" />
        {message ? <p className="mt-3 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-stone-700">{message}</p> : null}
        <button disabled={busy} className="mt-5 w-full rounded-full bg-rose-600 px-5 py-3 font-medium text-white disabled:opacity-60">{busy ? 'Подключаем…' : mode === 'signup' ? 'Создать и синхронизировать' : 'Войти и синхронизировать'}</button>
        <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
          <button type="button" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setMessage(''); }} className="text-rose-700">{mode === 'signup' ? 'Уже есть аккаунт' : 'Создать аккаунт'}</button>
          {mode === 'signin' ? <button type="button" onClick={reset} className="text-stone-600">Забыли пароль?</button> : null}
        </div>
      </form>
    </div>
  );
}

const cloudStatusLabels = {
  connecting: 'Подключаем облако…',
  syncing: 'Сохраняем в облако…',
  synced: 'Сохранено в облаке',
  offline: 'Офлайн — синхронизируем позже',
  error: 'Нужна повторная синхронизация',
  local: 'Сохранено только на устройстве',
};

function CloudAccountCard({ configured, user, status, error, onOpen, onSignOut }) {
  return (
    <div className="rounded-[28px] bg-white p-5 shadow-lg">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><span aria-hidden="true">☁</span> Облачная книга</h2>
      {!configured ? (
        <p className="mt-3 text-sm leading-6 text-stone-600">Облачное хранилище ещё подключается владельцем сайта.</p>
      ) : user ? (
        <>
          <p className="mt-3 break-all text-sm font-medium text-stone-700">{user.email}</p>
          <p className={cls('mt-2 text-sm', status === 'error' ? 'text-rose-700' : 'text-emerald-700')}>{cloudStatusLabels[status] || cloudStatusLabels.connecting}</p>
          {error ? <p className="mt-2 text-xs leading-5 text-rose-700">{error}</p> : null}
          <button onClick={onSignOut} className="mt-4 rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-600">Выйти</button>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm leading-6 text-stone-600">Войдите, чтобы рецепты и фотографии были доступны на всех устройствах.</p>
          <button onClick={onOpen} className="mt-4 w-full rounded-full bg-emerald-700 px-4 py-3 text-sm font-medium text-white">Войти и включить облако</button>
        </>
      )}
    </div>
  );
}

function CategoryManager({ categories, recipes, activeCategory, onSelectCategory, onAddCategory, onDeleteCategory }) {
  const [newCategory, setNewCategory] = useState('');

  const submitCategory = () => {
    const value = newCategory.trim();
    if (!value) return;
    onAddCategory(value);
    setNewCategory('');
  };

  return (
    <div className="rounded-[28px] bg-white p-5 shadow-lg">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon name="filter" className="h-5 w-5" /> Разделы
      </h2>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => onSelectCategory('Все')}
          className={cls(
            'rounded-full px-4 py-2 text-sm font-medium transition',
            activeCategory === 'Все' ? 'bg-stone-800 text-white' : 'bg-amber-50 text-stone-700 hover:bg-amber-100',
          )}
        >
          Все
        </button>

        {categories.map((cat) => {
          const count = recipes.filter((recipe) => recipe.category === cat).length;
          return (
            <div key={cat} className="flex items-center gap-1 rounded-full bg-amber-50 pr-1">
              <button
                onClick={() => onSelectCategory(cat)}
                className={cls(
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  activeCategory === cat ? 'bg-stone-800 text-white' : 'text-stone-700 hover:bg-amber-100',
                )}
              >
                {cat}
              </button>
              <span className="text-xs text-stone-500">{count}</span>
              <button
                onClick={() => onDeleteCategory(cat)}
                className="rounded-full p-2 text-stone-500 hover:bg-white hover:text-rose-600"
                title="Удалить категорию"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex gap-2">
        <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Новая категория" className="w-full rounded-2xl border border-amber-200 bg-[#fdfaf2] px-4 py-3 outline-none" />
        <button onClick={submitCategory} className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-medium text-white">
          Добавить
        </button>
      </div>
    </div>
  );
}

export default function RecipeBookPWA() {
  const cloud = useCloudRecipeBook(initialRecipes, defaultCategories);
  const { recipes, setRecipes, categories: customCategories, setCategories: setCustomCategories } = cloud;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Все');
  const [activeSection, setActiveSection] = useState('catalog');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    document.title = 'У меня вкуснее!😎';
  }, []);

  const categories = useMemo(() => {
    const merged = ensureUniqueCategories(customCategories, recipes);
    return merged.includes(FALLBACK_CATEGORY) ? merged : [...merged, FALLBACK_CATEGORY];
  }, [customCategories, recipes]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const byCategory = category === 'Все' || recipe.category === category;
      const byFavorite = !showFavoritesOnly || recipe.favorite;
      const haystack = [recipe.title, recipe.note, recipe.author, recipe.category, ...(recipe.ingredients || [])].join(' ').toLowerCase();
      const byQuery = haystack.includes(query.trim().toLowerCase());
      return byCategory && byFavorite && byQuery;
    });
  }, [recipes, category, query, showFavoritesOnly]);

  const featuredRecipe = filteredRecipes[0] || recipes[0] || null;
  const favoritesCount = recipes.filter((recipe) => recipe.favorite).length;

  const toggleFavorite = (id) => {
    setRecipes((prev) => prev.map((recipe) => (recipe.id === id ? { ...recipe, favorite: !recipe.favorite } : recipe)));
    setSelectedRecipe((prev) => (prev && prev.id === id ? { ...prev, favorite: !prev.favorite } : prev));
  };

  const addRecipe = (recipe) => {
    setRecipes((prev) => [recipe, ...prev]);
    if (recipe.category && !customCategories.includes(recipe.category)) {
      setCustomCategories((prev) => [...prev, recipe.category]);
    }
  };

  const updateRecipe = (updatedRecipe) => {
    setRecipes((prev) => prev.map((recipe) => (recipe.id === updatedRecipe.id ? updatedRecipe : recipe)));
    setSelectedRecipe((prev) => (prev && prev.id === updatedRecipe.id ? updatedRecipe : prev));
    if (updatedRecipe.category && !customCategories.includes(updatedRecipe.category)) {
      setCustomCategories((prev) => [...prev, updatedRecipe.category]);
    }
  };

  const deleteRecipe = (recipe) => {
    const ok = window.confirm(`Удалить рецепт «${recipe.title}»?`);
    if (!ok) return;
    setRecipes((prev) => prev.filter((item) => item.id !== recipe.id));
    setSelectedRecipe((prev) => (prev && prev.id === recipe.id ? null : prev));
    setEditingRecipe((prev) => (prev && prev.id === recipe.id ? null : prev));
  };

  const addCategory = (value) => {
    if (customCategories.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    setCustomCategories((prev) => [...prev, value]);
  };

  const deleteCategory = (value) => {
    if (value === FALLBACK_CATEGORY) {
      alert('Категорию «Без категории» удалить нельзя.');
      return;
    }
    const recipesInCategory = recipes.filter((recipe) => recipe.category === value).length;
    const ok = window.confirm(
      recipesInCategory > 0
        ? `В категории «${value}» есть ${recipesInCategory} рецепт(ов). Удалить категорию и перенести эти рецепты в «${FALLBACK_CATEGORY}»?`
        : `Удалить категорию «${value}»?`,
    );
    if (!ok) return;
    setCustomCategories((prev) => prev.filter((item) => item !== value));
    setRecipes((prev) => prev.map((recipe) => (recipe.category === value ? { ...recipe, category: FALLBACK_CATEGORY } : recipe)));
    if (category === value) setCategory('Все');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f8ecd5_0%,#efe0c2_35%,#ead8b5_100%)] text-stone-800">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[36px] border border-amber-200 bg-[#fdf7ea] shadow-2xl shadow-amber-200/40">
          <div className="absolute inset-y-0 left-0 w-12 bg-[repeating-linear-gradient(to_bottom,#6b4f3a_0,#6b4f3a_32px,#7b5c45_32px,#7b5c45_64px)]" />
          <div className="absolute right-6 top-6 hidden h-32 w-10 rounded-b-3xl bg-rose-600 shadow-lg md:block" />

          <div className="relative grid gap-8 p-6 pl-20 md:grid-cols-[1.2fr_0.8fr] md:p-10 md:pl-24">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-2 text-sm text-rose-700">
                <Icon name="sparkles" className="h-4 w-4" /> Друзяшке-таракашке)
              </p>
              <h1 className="mt-5 text-4xl font-bold leading-tight md:text-6xl">
                У меня вкуснее!😎
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600 md:text-lg">
                Эта книга принадлежит наилучшему повару этом мире у которого всё всегда вкуснее ведь он лучше знает как надо — Шефу Виктору
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={() => setActiveSection('catalog')} className="rounded-full bg-stone-800 px-5 py-3 text-sm font-medium text-white shadow-lg">
                  Открыть каталог
                </button>
                <button onClick={() => setShowAddModal(true)} className="rounded-full bg-rose-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-rose-200">
                  Новый шедевр
                </button>
                <button onClick={installPWA} className="rounded-full border border-amber-300 bg-white px-5 py-3 text-sm font-medium text-stone-700">
                  Установить как PWA
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 self-end">
              <div className="rounded-[28px] bg-white p-5 shadow-lg">
                <div className="flex items-center gap-2 text-stone-500">
                  <Icon name="book" className="h-4 w-4" /> Шедевров
                </div>
                <p className="mt-3 text-4xl font-bold">{recipes.length}</p>
              </div>
              <div className="rounded-[28px] bg-white p-5 shadow-lg">
                <div className="flex items-center gap-2 text-stone-500">
                  <Icon name="heart" className="h-4 w-4" /> Шедевральных шедевров
                </div>
                <p className="mt-3 text-4xl font-bold">{favoritesCount}</p>
              </div>
              <div className="col-span-2 rounded-[28px] bg-stone-800 p-5 text-stone-100 shadow-lg">
                <div className="flex items-center gap-2 text-stone-300">
                  <Icon name="bookmark" className="h-4 w-4" /> Самому лучшему в мире Друзяшке-таракаше!🥳
                </div>
                <p className="mt-3 text-lg leading-7">
                  Поздравляю тебя с днём рождения, желаю готовить много вкусностей и кормить ими меня🥰 С безграничной любовью, Настенька Сестричка
                </p>
              </div>
            </div>
          </div>
        </motion.header>

        <section className="relative mt-8">
          <div className="flex flex-wrap gap-3 overflow-x-auto pb-4">
            <Ribbon label="Главная" active={activeSection === 'home'} onClick={() => setActiveSection('home')} colorClass="bg-stone-700" />
            <Ribbon label="Каталог" active={activeSection === 'catalog'} onClick={() => setActiveSection('catalog')} colorClass="bg-rose-700" />
            <Ribbon label="Избранное" active={activeSection === 'favorites'} onClick={() => { setActiveSection('favorites'); setShowFavoritesOnly(true); }} colorClass="bg-amber-700" />
            <Ribbon label="Добавить" active={activeSection === 'add'} onClick={() => { setActiveSection('add'); setShowAddModal(true); }} colorClass="bg-emerald-700" />
          </div>
        </section>

        <main className="rounded-[36px] border border-amber-200 bg-[#fdf7ea] p-4 shadow-2xl shadow-amber-100/50 md:p-8">
          <div className="grid gap-8 xl:grid-cols-[300px_1fr]">
            <aside className="space-y-5">
              <CloudAccountCard configured={cloud.configured} user={cloud.user} status={cloud.status} error={cloud.error} onOpen={() => setShowAuthModal(true)} onSignOut={cloud.logOut} />

              <div className="rounded-[28px] bg-white p-5 shadow-lg">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Icon name="search" className="h-5 w-5" /> Ну и что у тебя там ещё не сгнило?)
                </h2>
                <div className="mt-4 rounded-2xl border border-amber-200 bg-[#fdfaf2] px-4 py-3">
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Название, ингредиент, категория" className="w-full bg-transparent outline-none" />
                </div>
              </div>

              <CategoryManager categories={categories} recipes={recipes} activeCategory={category} onSelectCategory={setCategory} onAddCategory={addCategory} onDeleteCategory={deleteCategory} />

              <div className="rounded-[28px] bg-white p-5 shadow-lg">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Icon name="star" className="h-5 w-5" /> Личная полка
                </h2>
                <button onClick={() => { setShowFavoritesOnly((v) => !v); setActiveSection('favorites'); }} className={cls('mt-4 w-full rounded-2xl px-4 py-3 text-sm font-medium transition', showFavoritesOnly ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700')}>
                  {showFavoritesOnly ? 'Показываются только избранные' : 'Показать только избранные'}
                </button>
              </div>

              <div className="rounded-[28px] bg-stone-800 p-5 text-stone-100 shadow-lg">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Icon name="camera" className="h-5 w-5" /> Фото и новые страницы
                </h2>
                <p className="mt-3 text-sm leading-6 text-stone-300">
                  {cloud.user ? 'Рецепты и фотографии сохраняются в облаке и доступны на всех ваших устройствах.' : 'Войдите в облачную книгу, чтобы открыть рецепты на любом устройстве.'}
                </p>
                <button onClick={() => setShowAddModal(true)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-stone-800">
                  <Icon name="plus" className="h-4 w-4" /> Добавить шедевр
                </button>
              </div>
            </aside>

            <section>
              {featuredRecipe ? (
                <div className="mb-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                  <motion.div layout className="overflow-hidden rounded-[32px] bg-white shadow-xl">
                    <div className="grid h-full md:grid-cols-[1.1fr_0.9fr]">
                      <img src={featuredRecipe.image} alt={featuredRecipe.title} className="h-full min-h-[280px] w-full object-cover" />
                      <div className="flex flex-col justify-between p-6">
                        <div>
                          <p className="text-sm uppercase tracking-[0.25em] text-stone-500">Рекомендуемая страница</p>
                          <h2 className="mt-3 text-3xl font-bold text-stone-800">{featuredRecipe.title}</h2>
                          <p className="mt-3 text-stone-600">{featuredRecipe.note}</p>
                        </div>
                        <div>
                          <div className="mb-4 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700">{featuredRecipe.category}</span>
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">{featuredRecipe.time}</span>
                            <span className="rounded-full bg-stone-200 px-3 py-1 text-stone-700">{featuredRecipe.difficulty}</span>
                          </div>
                          <button onClick={() => setSelectedRecipe(featuredRecipe)} className="rounded-full bg-stone-800 px-5 py-3 text-sm font-medium text-white">
                            Читать рецепт
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              ) : null}

              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-stone-800">Каталог рецептов</h2>
                  <p className="text-stone-500">{filteredRecipes.length} найдено</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setActiveSection('home')} className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-sm text-stone-700">
                    <Icon name="home" className="h-4 w-4" /> Главная
                  </button>
                  <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm text-white">
                    <Icon name="plus" className="h-4 w-4" /> Новый шедевр
                  </button>
                  <button onClick={installPWA} className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-white px-4 py-2 text-sm text-stone-700">
                    <Icon name="folder" className="h-4 w-4" /> PWA
                  </button>
                </div>
              </div>

              {filteredRecipes.length === 0 ? (
                <div className="rounded-[32px] bg-white p-10 text-center shadow-lg">
                  <h3 className="text-2xl font-bold text-stone-800">Ничего не найдено</h3>
                  <p className="mt-3 text-stone-500">Попробуй изменить поиск или добавить новый шедевр.</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3">
                    {filteredRecipes.map((recipe) => (
                      <RecipeCard key={recipe.id} recipe={recipe} onOpen={setSelectedRecipe} onToggleFavorite={toggleFavorite} onEdit={setEditingRecipe} onDelete={deleteRecipe} />
                    ))}
                  </div>
                </AnimatePresence>
              )}
            </section>
          </div>
        </main>
      </div>

      <RecipeModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} onToggleFavorite={toggleFavorite} />

      <RecipeEditorModal open={showAddModal} onClose={() => setShowAddModal(false)} onSave={addRecipe} categoryOptions={categories.length ? categories : [FALLBACK_CATEGORY]} mode="add" />

      <RecipeEditorModal open={Boolean(editingRecipe)} onClose={() => setEditingRecipe(null)} onSave={updateRecipe} categoryOptions={categories.length ? categories : [FALLBACK_CATEGORY]} initialRecipe={editingRecipe} mode="edit" />

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} onSignIn={cloud.signIn} onSignUp={cloud.signUp} onResetPassword={cloud.resetPassword} />
    </div>
  );
}
