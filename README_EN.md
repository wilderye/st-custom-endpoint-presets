**English** | [中文](./README.md)

# ST Custom Endpoint Presets

> Lightweight endpoint bookmark manager for SillyTavern's Custom (OpenAI-compatible) API source.

## Why This Script?

SillyTavern already has a **Connection Manager** for switching API configurations. But it saves *everything* — URL, Model, Preset, API source, and 20+ other settings. For many users, all they need is to quickly switch between a few **URL + API Key + Model** combinations.

This script does exactly that:

| | Connection Manager | This Script |
|---|---|---|
| Scope | Full environment snapshot (20+ settings) | Only URL + API Key + Model |
| Complexity | Profile-based, many buttons and options | One dropdown, four buttons |
| Use case | "I switch between completely different setups" | "I just want to change my API endpoint" |

Both can coexist — if Connection Manager changes your settings, this script's dropdown automatically resets to avoid conflicts.

## Requirements

- [SillyTavern](https://github.com/SillyTavern/SillyTavern) ≥ **1.13.0**
- [Tavern Helper (酒馆助手)](https://n0vi028.github.io/JS-Slash-Runner-Doc/guide/%E5%85%B3%E4%BA%8E%E9%85%92%E9%A6%86%E5%8A%A9%E6%89%8B/%E5%AE%89%E8%A3%85%E4%B8%8E%E6%9B%B4%E6%96%B0.html)

## Installation

1. Open SillyTavern → Tavern Helper → Scripts
2. Create a **Global Script**
3. Paste the following into the script content:

```
import 'https://testingcf.jsdelivr.net/gh/wilderye/st-custom-endpoint-presets/dist/custom-endpoint-bookmarks/index.js'
```

4. Enable the script

## Usage

1. Go to **API** → **Chat Completion** → select **Custom (OpenAI-compatible)**
2. Fill in your URL, API Key, and Model as usual
3. Click **➕** to save as a named preset
4. Use the **dropdown** to switch between saved presets
5. **💾** overwrites the selected preset with current settings
6. **✏️** renames, **🗑️** deletes

The **checkbox** near Connection Manager ("Keep API settings when switching presets") prevents Chat Completion preset switching from overwriting your API connection.
