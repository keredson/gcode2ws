include <BOSL2/std.scad>
include <BOSL2/screws.scad>

w=29;
h=7;
l=51.5+7;
T=2;
wifi_h = 7;
text_depth = 1;
cam_d = 8.1;
cam_offset = 34.5;
corner_r = 2;
INCH = 25.4;

module engrave_text(s, size=10, font="", halign="left", valign="baseline", spacing=1, direction="ltr", language="en", script="latin", depth=1) {
  step_size = .05;
  for (i=[0:step_size:depth])
  translate([0,0,-i]) 
  linear_extrude(step_size)
  offset(delta=-i/depth)
  text(s, size=size, halign=halign, valign=valign, spacing=spacing, direction=direction, language=language, script=script);
}

module usb_c(h=10) {
  w = 3.5;
  l = 9;
  $fn=20;
  hull() {
    translate([-l/2+w/2,0,0]) cylinder(h, r=w/2);
    translate([+l/2-w/2,0,0]) cylinder(h, r=w/2);
  }
}

module case() {
  difference() {
    union() {
      translate([-T,-T,-T]) minkowski() {
        cube([w+2*T-2*corner_r,h+2*T-2*corner_r,l+T+1-2*corner_r]);
        translate([corner_r,corner_r,corner_r]) sphere(corner_r, $fn=8);
      }
      translate([-T-9,-T,l-T-4-T]) minkowski() {
        cube([w+2*T-2*corner_r,h+2*T-2*corner_r,5]);
        translate([corner_r,corner_r,corner_r]) sphere(corner_r, $fn=8);
      }
    }
    difference() {
      cube([w,h,l]);
      translate([0,h-1.7,l-1]) cube([w,1.7,1]);
    }

    translate([w/2-2.25/2-9/2,3.5/2,l-1]) usb_c();
    translate([w/2+2.25/2+9/2,3.5/2,l-1]) usb_c();
    
    translate([w/2,0,l-cam_offset-cam_d/2]) rotate([90,0,0]) cylinder(100, r=cam_d/2, $fn=40);
    translate([w/2-cam_d/2, -T, l-cam_offset-cam_d]) cube([cam_d,2.2,cam_d]);
    
    translate([w/2,T+h,l/2+3])
    rotate([-90,-90,0]) 
    engrave_text("ws2usb", size=10, valign="center", halign="center", depth=2);
    
    translate([-6,h/2,l-25.4/4+2*T+.2]) screw_hole("1/4-20,1/4", thread=true);
    
    translate([w/2-15/2+2,h-2,-100+8-T]) cube([15-2,100,100]);
    
    translate([11, 0, l-12.2]) rotate([90,0,0]) cylinder(T-.5, r=1, $fn=10);
    translate([22.75, 0, l-12.5]) rotate([90,0,0]) cylinder(100, r=1, $fn=10);

    translate([25.75,0-T,l-12.5])
    rotate([90,180,0]) 
    engrave_text("R", size=2, valign="center", halign="center", depth=2);
    
  }
}

//!case();

translate([0,0,h/2+T]) difference() {
  translate([T,T,h/2]) rotate([-90,0,0]) case();
  translate([-50,0,0]) cube([100,100,100]);
  translate([T/2, T/2, -h/2+1]) cube([w+T,l+T/2,100]);
}

translate([w+3*T,0,0]) difference() {
  translate([T+w,T,T]) rotate([90,0,180]) case();
  translate([0,0,h/2+T]) difference() {
    cube([100,100,100]);
    translate([T/2, T/2, 0]) cube([w+T,l+T/2-1,h/2-1]);
  }
  
}




