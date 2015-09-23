#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
//uniform vec2 u_mouse;
uniform vec2 u_resolution;

#define iterations 10
#define formuparam 0.853

#define volsteps 3
#define stepsize 0.151

#define zoom   10.0
#define tile   0.50
#define speed  0.00031

#define brightness 0.0015
#define darkmatter 0.100
#define distfading 0.70
#define saturation 0.750


void main(void)
{
	//get coords and direction
	vec2 uv=gl_FragCoord.xy/u_resolution.xy*.5;
	uv.y*=u_resolution.y/u_resolution.x;
	vec3 dir=vec3(uv*zoom,1.);
	float u_time=u_time*speed+.25;

	//u_mouse rotation
	float a1=.5+20./u_resolution.x*2.;
	float a2=.8+1./u_resolution.y*2.;
	mat2 rot1=mat2(cos(a1),sin(a1),-sin(a1),cos(a1));
	mat2 rot2=mat2(cos(a2),sin(a2),-sin(a2),cos(a2));
	dir.xz*=rot1*u_time;
	dir.xy*=rot2;
	vec3 from=vec3(1.,.5,0.5);
	from+=vec3(u_time*0.,u_time,-2.);
	from.xz*=rot1;
	from.xy*=rot2;

	//volumetric rendering
	float s=0.1,fade=1.;
	vec3 v=vec3(0.);
	for (int r=0; r<volsteps; r++) {
		vec3 p=from+s*dir*.5;
		p = abs(vec3(tile)-mod(p,vec3(tile*2.0))); // tiling fold
		float pa,a=pa=0.;
		for (int i=0; i<iterations; i++) {
			p=abs(p)/dot(p,p)-formuparam; // the magic formula
			a+=abs(length(p)-0.1*pa); // absolute sum of average change
			pa=length(p);
		}
		float dm=max(0.,darkmatter-a*a*.001); //dark matter
		a*=a*a; // add contrast
		if (r>6) fade*=1.-dm; // dark matter, don't render near
		//v+=vec3(dm,dm*.5,0.);
		v+=fade;
		v+=vec3(s,s,4.*s*s*s*s)*a*brightness*fade; // coloring based on distance
		fade*=distfading; // distance fading
		s+=stepsize;
	}
	v=mix(vec3(length(v)),v,saturation); //color adjust
	vec3 col = v*.01;
	if(col.x+col.y+col.z<0.6)col = vec3(0.0,0.,1.);
	gl_FragColor = vec4(v*.014,1.);

}