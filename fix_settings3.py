content = open("src/pages/Settings.tsx").read()
content = content.replace("const { allDrivers } = useDrivers();", "")
content = content.replace("const [keyInput, setKeyInput] = useState(\"\");", "const [keyInput, setKeyInput] = useState(\"\");\n  const { allDrivers } = useDrivers();")
open("src/pages/Settings.tsx", "w").write(content)
