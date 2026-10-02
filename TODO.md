- simplify the conection to the esp32. just an io board
- check to make it online with gcp
- add the privacy text. Since we’re excited about the possibility of presenting this work in a public space, we’re happy to add a sign near the installation stating that no information from participants is being recorded.

- make it look nicer:
    - transperent blurry camera feedback.

- add the new vivbration:
    drv.selectLibrary(1);
  drv.setMode(DRV2605_MODE_INTTRIG);

  // Heartbeat: "lub" - pause - "dub"
  drv.setWaveform(0, 1);          // Strong Click 100%  (lub)
  drv.setWaveform(1, 0x80 | 12);  // wait 120 ms
  drv.setWaveform(2, 2);          // Strong Click 60%   (dub)
  drv.setWaveform(3, 0);          // end of sequence

- look for a box
- with wip:
    confirm the computer and monitor
    
