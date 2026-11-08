// flair-metal-hash: 70f9954c
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float uScreen;
    float uAspect;
    float uBeam;
    float uDust;
    float uFlicker;
    float uAudience;
    float3 uRoom;
    float3 uCurtain;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_cinema_projector_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _244)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_244.uBackdrop) * _244.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_244.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _244)
{
    float4 _381;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _381 = overBackdrop(param, _244);
    }
    else
    {
        float2 param_1 = fract(uv);
        _381 = float4(testCard(param_1), 1.0);
    }
    return _381;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _244)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _244).xyz;
}

static inline __attribute__((always_inline))
float3 onScreen(thread const float2& s, constant FlairUniforms& _244, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 size = float2(int2(uImage.get_width(), uImage.get_height()));
    float _417;
    if (size.x > 1.0)
    {
        _417 = size.x / size.y;
    }
    else
    {
        _417 = _244.uAspect;
    }
    float imageAspect = _417;
    float2 _435;
    if (_244.uAspect > imageAspect)
    {
        _435 = float2(1.0, imageAspect / _244.uAspect);
    }
    else
    {
        _435 = float2(_244.uAspect / imageAspect, 1.0);
    }
    float2 scale = _435;
    float2 param = float2(0.5) + ((s - float2(0.5)) * scale);
    return picture(uImage, uImageSmplr, param, _244);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _244, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_244.iResolution[0], _244.iResolution[1]);
    float aspect = _244.iResolution[0u] / _244.iResolution[1u];
    float frame = floor(_244.iTime * 24.0);
    float2 param = float2(frame, 3.0);
    float flicker = 1.0 - (_244.uFlicker * ((0.119999997317790985107421875 * hash12(param)) + (0.039999999105930328369140625 * sin(_244.iTime * 47.0))));
    float2 param_1 = float2(frame, 1.0);
    float2 param_2 = float2(frame, 2.0);
    float2 weave = ((float2(hash12(param_1), hash12(param_2)) - float2(0.5)) * 0.00200000009499490261077880859375) * _244.uFlicker;
    float2 size = float2(_244.uScreen, fast::min((_244.uScreen * aspect) / _244.uAspect, 0.560000002384185791015625));
    float2 lo = float2(0.5, 0.550000011920928955078125) - (size * 0.5);
    float2 hi = lo + size;
    float2 s = (uv - lo) / size;
    float2 param_3 = float2(0.5);
    float2 param_4 = float2(0.25, 0.300000011920928955078125);
    float2 param_5 = float2(0.75, 0.300000011920928955078125);
    float2 param_6 = float2(0.25, 0.699999988079071044921875);
    float2 param_7 = float2(0.75, 0.699999988079071044921875);
    float3 spill = (((((onScreen(param_3, _244, uImage, uImageSmplr) + onScreen(param_4, _244, uImage, uImageSmplr)) + onScreen(param_5, _244, uImage, uImageSmplr)) + onScreen(param_6, _244, uImage, uImageSmplr)) + onScreen(param_7, _244, uImage, uImageSmplr)) * 0.20000000298023223876953125) * flicker;
    float2 q = float2(uv.x * aspect, uv.y);
    float2 sc = float2(0.5 * aspect, 0.550000011920928955078125);
    float3 col = _244.uRoom + ((spill * 0.100000001490116119384765625) * exp((-2.0) * length(q - sc)));
    float margin = 0.02999999932944774627685546875;
    float side = fast::max((lo.x - margin) - uv.x, (uv.x - hi.x) - margin);
    if (side > 0.0)
    {
        float folds = 0.550000011920928955078125 + (0.449999988079071044921875 * sin(((uv.x * aspect) * 70.0) + sin(uv.y * 3.0)));
        float3 curtain = ((_244.uCurtain * folds) * (float3(0.3499999940395355224609375) + (spill * 0.60000002384185791015625))) * (1.0 - (smoothstep(0.0, 0.3499999940395355224609375, side) * 0.699999988079071044921875));
        col = mix(col, curtain, float3(smoothstep(0.0, 0.00999999977648258209228515625, side)));
    }
    float2 edge = (fast::min(s, float2(1.0) - s) * size) * float2(_244.iResolution[0], _244.iResolution[1]);
    float inside = fast::clamp(fast::min(edge.x, edge.y), 0.0, 1.0);
    float2 param_8 = s + weave;
    float3 shown = (onScreen(param_8, _244, uImage, uImageSmplr) * flicker) * (1.08000004291534423828125 - (0.300000011920928955078125 * length(s - float2(0.5))));
    col = mix(col, shown, float3(inside));
    float2 src = float2(0.5 * aspect, 1.25);
    float2 tl = float2(lo.x * aspect, hi.y);
    float2 tr = float2(hi.x * aspect, hi.y);
    float2 d = q - src;
    float across = (d.x / fast::max(-d.y, 9.9999997473787516355514526367188e-05)) / ((tr.x - src.x) / (src.y - tr.y));
    float down = fast::clamp((-d.y) / (src.y - tr.y), 0.0, 1.0);
    float inBeam = ((1.0 - smoothstep(0.85000002384185791015625, 1.0, abs(across))) * step(hi.y, q.y)) * step(q.y, src.y);
    float2 param_9 = float2(across * 18.0, _244.iTime * 0.300000011920928955078125);
    float rays = 0.60000002384185791015625 + (0.4000000059604644775390625 * vnoise(param_9));
    float2 param_10 = (q * 3.0) + float2(_244.iTime * 0.039999999105930328369140625, (-_244.iTime) * 0.0199999995529651641845703125);
    int param_11 = 4;
    float _804 = fbm(param_10, param_11);
    float haze = _804;
    float3 beamLight = mix(float3(1.0, 0.949999988079071044921875, 0.85000002384185791015625), spill * 2.0, float3(0.5));
    col += (((((((beamLight * inBeam) * _244.uBeam) * 0.319999992847442626953125) * rays) * (0.4000000059604644775390625 + haze)) * (0.5 + (0.5 * down))) * flicker);
    float2 g = (q * 90.0) + float2(_244.iTime * 1.5, (-_244.iTime) * 2.5);
    float2 cell = floor(g);
    float2 param_12 = cell;
    float2 param_13 = cell;
    float mote = step(1.0 - (0.0599999986588954925537109375 * _244.uDust), hash12(param_12)) * smoothstep(0.25, 0.0, length(fract(g) - hash22(param_13)));
    col += ((((beamLight * mote) * inBeam) * _244.uDust) * 0.60000002384185791015625);
    float sil = 0.0;
    float rim = 0.0;
    for (int k = 0; k < 7; k++)
    {
        float fk = float(k);
        float2 param_14 = float2(fk, 9.1000003814697265625);
        if (hash12(param_14) > _244.uAudience)
        {
            continue;
        }
        float2 param_15 = float2(fk, 4.19999980926513671875);
        float x = ((((fk + 0.5) / 7.0) + ((hash12(param_15) - 0.5) * 0.0599999986588954925537109375)) * aspect) + (sin((_244.iTime * 0.4000000059604644775390625) + (fk * 2.0)) * 0.0040000001899898052215576171875);
        float2 param_16 = float2(fk, 5.30000019073486328125);
        float y = 0.1500000059604644775390625 + (hash12(param_16) * 0.02999999932944774627685546875);
        float2 head = (q - float2(x, y)) / float2(0.054999999701976776123046875, 0.06800000369548797607421875);
        float2 body = (q - float2(x, -0.0199999995529651641845703125)) / float2(0.1500000059604644775390625, 0.119999997317790985107421875);
        float dh = (length(head) - 1.0) * 0.054999999701976776123046875;
        float db = (length(body) - 1.0) * 0.119999997317790985107421875;
        float dd = fast::min(dh, db);
        sil = fast::max(sil, 1.0 - smoothstep(-0.00150000001303851604461669921875, 0.00150000001303851604461669921875, dd));
        rim = fast::max(rim, ((smoothstep(-0.01200000010430812835693359375, 0.0, dd) * (1.0 - smoothstep(0.0, 0.00150000001303851604461669921875, dd))) * smoothstep(0.0, 0.5, head.y)) * step(dh, db));
    }
    col = mix(col, float3(0.01200000010430812835693359375) + ((spill * 0.60000002384185791015625) * rim), float3(sil));
    fragColor = float4(col, 1.0);
}

fragment flair_cinema_projector_frag_out flair_cinema_projector_frag(constant FlairUniforms& _244 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_cinema_projector_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1026;
    if (_244.flair_flipY > 0.5)
    {
        _1026 = _244.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1026 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1026);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _244, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

