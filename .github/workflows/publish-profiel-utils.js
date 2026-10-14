#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const YAML = require('js-yaml');

function parseYaml(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error('Invalid YAML frontmatter');
  return YAML.load(match[1]) || {};
}

function dumpYaml(data) {
  return YAML.dump(data, { lineWidth: -1, noRefs: true, sortKeys: false });
}

async function processProfile(pendingFile) {
  const basename = path.basename(pendingFile);
  const isUpdate = basename.startsWith('update-');

  console.log(`\n📄 Processing: ${basename}`);
  const pendingContent = fs.readFileSync(pendingFile, 'utf8');
  const pendingData = parseYaml(pendingContent);

  if (isUpdate) {
    console.log(`🔄 Update-profiel gedetecteerd`);

    const emailFromFilename = basename
      .replace(/^update-/, '')
      .replace(/\.md$/, '')
      .toLowerCase();

    console.log(`   Email (van bestandsnaam): ${emailFromFilename}`);

    const bewustMakersDir = '_bewust-makers';
    let targetFile = null;
    let existingData = null;

    if (fs.existsSync(bewustMakersDir)) {
      const files = fs.readdirSync(bewustMakersDir).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const content = fs.readFileSync(path.join(bewustMakersDir, file), 'utf8');
        const data = parseYaml(content);

        if (data.email_zichtbaar?.toLowerCase() === emailFromFilename) {
          targetFile = path.join(bewustMakersDir, file);
          existingData = data;
          console.log(`   ✓ Bestaand bestand gevonden: ${file}`);
          break;
        }
      }
    }

    if (!targetFile) {
      throw new Error(`Bestaand profiel niet gevonden voor ${emailFromFilename}`);
    }

    console.log(`   📝 Merging wijzigingen...`);
    const mergedData = { ...existingData };
    let changeCount = 0;

    for (const [key, value] of Object.entries(pendingData)) {
      if (key === 'layout' || key === 'permalink' || key === 'gepubliceerd' || key === 'tally_submission_id') {
        continue;
      }

      if (value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0)) {
        mergedData[key] = value;
        changeCount++;
      }
    }

    console.log(`   ✓ ${changeCount} veld(en) bijgewerkt`);

    const mergedYaml = dumpYaml(mergedData);
    const mergedContent = `---\n${mergedYaml}---\n`;
    fs.writeFileSync(targetFile, mergedContent);

    fs.unlinkSync(pendingFile);
    console.log(`   ✓ Update-bestand verwijderd`);

    return {
      type: 'update',
      target: targetFile,
      pending: pendingFile,
      profileName: mergedData.naam || 'Unknown'
    };
  } else {
    console.log(`✨ Nieuw profiel gedetecteerd`);

    const targetFile = path.join('_bewust-makers', basename);

    if (fs.existsSync(targetFile)) {
      throw new Error(`Doelbestand bestaat al: ${targetFile}`);
    }

    fs.renameSync(pendingFile, targetFile);
    console.log(`   ✓ Verplaatst naar ${targetFile}`);

    return {
      type: 'new',
      target: targetFile,
      pending: pendingFile,
      profileName: pendingData.naam || 'Unknown'
    };
  }
}

if (require.main === module) {
  const pendingFile = process.argv[2];
  if (!pendingFile) {
    console.error('Usage: node publish-profiel-utils.js <pending-file>');
    process.exit(1);
  }

  processProfile(pendingFile)
    .then(result => {
      console.log(`\n✅ Klaar: ${result.profileName}`);
      console.log(`   Type: ${result.type}`);
      console.log(`   Target: ${result.target}`);
      process.exit(0);
    })
    .catch(err => {
      console.error(`\n❌ Fout: ${err.message}`);
      process.exit(1);
    });
}

module.exports = { processProfile };
