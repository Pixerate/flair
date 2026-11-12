// flair-metal-hash: 8c7d55c1
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
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
    float uSize;
    float3 uCabinet;
    packed_float3 uRoom;
    float uScanlines;
    float uStatic;
    float uGlare;
    uint uAntenna;
    char _m20_pad[4];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_crt_television_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _226)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_226.uBackdrop) * _226.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_226.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _226)
{
    float4 _363;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _363 = overBackdrop(param, _226);
    }
    else
    {
        float2 param_1 = fract(uv);
        _363 = float4(testCard(param_1), 1.0);
    }
    return _363;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _226)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _226).xyz;
}

static inline __attribute__((always_inline))
float segment(thread const float2& p, thread const float2& a, thread const float2& b)
{
    float2 pa = p - a;
    float2 ba = b - a;
    return length(pa - (ba * fast::clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)));
}

static inline __attribute__((always_inline))
float roundBox(thread const float2& p, thread const float2& hs, thread const float& r)
{
    float2 q = (abs(p) - hs) + float2(r);
    return (length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
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
float scanlines(thread const float& y, thread const float& amount)
{
    return 1.0 - ((amount * 0.5) * (1.0 - cos(y * 3.141590118408203125)));
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _226, texture2d<float> uImage, sampler uImageSmplr)
{
    float px = 1.0 / _226.iResolution[1u];
    float2 p = (((fragCoord - (float2(_226.iResolution[0], _226.iResolution[1]) * 0.5)) / float2(_226.iResolution[1u])) / float2(_226.uSize)) + float2(0.0, 0.02999999932944774627685546875);
    float pxs = px / _226.uSize;
    float frame = floor(_226.iTime * 30.0);
    float2 param = float2(0.5);
    float2 param_1 = float2(0.25);
    float2 param_2 = float2(0.75);
    float2 param_3 = float2(0.25, 0.75);
    float2 param_4 = float2(0.75, 0.25);
    float3 glowCol = ((((picture(uImage, uImageSmplr, param, _226) + picture(uImage, uImageSmplr, param_1, _226)) + picture(uImage, uImageSmplr, param_2, _226)) + picture(uImage, uImageSmplr, param_3, _226)) + picture(uImage, uImageSmplr, param_4, _226)) / float3(5.0);
    float2 screenC = float2(-0.119999997317790985107421875, 0.0199999995529651641845703125);
    float floorY = -0.4699999988079071044921875;
    float3 _517;
    if (p.y < floorY)
    {
        _517 = float3(_226.uRoom) * 0.550000011920928955078125;
    }
    else
    {
        _517 = float3(_226.uRoom);
    }
    float3 col = _517;
    col += ((glowCol * 0.2199999988079071044921875) * exp((-length((p - screenC) * float2(0.699999988079071044921875, 1.0))) * 2.400000095367431640625));
    col *= (1.0 - ((0.5 * exp(-powr(length((p - float2(0.0, floorY)) * float2(1.0, 6.0)) / 0.699999988079071044921875, 2.0))) * step(p.y, floorY + 0.0199999995529651641845703125)));
    if (_226.uAntenna != 0u)
    {
        float2 param_5 = p;
        float2 param_6 = float2(0.0500000007450580596923828125, 0.4000000059604644775390625);
        float2 param_7 = float2(-0.300000011920928955078125, 0.7799999713897705078125);
        float2 param_8 = p;
        float2 param_9 = float2(0.07999999821186065673828125, 0.4000000059604644775390625);
        float2 param_10 = float2(0.4199999868869781494140625, 0.7400000095367431640625);
        float ears = fast::min(segment(param_5, param_6, param_7), segment(param_8, param_9, param_10));
        float balls = fast::min(length(p - float2(-0.300000011920928955078125, 0.7799999713897705078125)), length(p - float2(0.4199999868869781494140625, 0.7400000095367431640625))) - 0.01200000010430812835693359375;
        col = mix(col, float3(0.62000000476837158203125, 0.63999998569488525390625, 0.680000007152557373046875), float3(1.0 - smoothstep(0.0, pxs * 1.5, fast::min(ears - 0.0040000001899898052215576171875, balls))));
        col = mix(col, float3(0.100000001490116119384765625), float3(1.0 - smoothstep(0.0, pxs, length(p - float2(0.064999997615814208984375, 0.4050000011920928955078125)) - 0.0350000001490116119384765625)));
    }
    float2 param_11 = p;
    float2 param_12 = float2(-0.4799999892711639404296875, -0.37999999523162841796875);
    float2 param_13 = float2(-0.519999980926513671875, floorY + 0.00999999977648258209228515625);
    float2 param_14 = p;
    float2 param_15 = float2(0.4799999892711639404296875, -0.37999999523162841796875);
    float2 param_16 = float2(0.519999980926513671875, floorY + 0.00999999977648258209228515625);
    float legs = fast::min(segment(param_11, param_12, param_13), segment(param_14, param_15, param_16)) - 0.01200000010430812835693359375;
    col = mix(col, _226.uCabinet * 0.449999988079071044921875, float3(1.0 - smoothstep(0.0, pxs, legs)));
    float2 param_17 = p;
    float2 param_18 = float2(0.63999998569488525390625, 0.4000000059604644775390625);
    float param_19 = 0.0500000007450580596923828125;
    float box = roundBox(param_17, param_18, param_19);
    float2 param_20 = p * 4.0;
    float2 param_21 = float2(p.x * 2.5, (p.y * 38.0) + (3.0 * vnoise(param_20)));
    int param_22 = 4;
    float _702 = fbm(param_21, param_22);
    float grain = _702;
    float3 wood = _226.uCabinet * (0.7200000286102294921875 + (0.5 * grain));
    wood *= (0.800000011920928955078125 + ((0.3499999940395355224609375 * smoothstep(-0.02999999932944774627685546875, 0.0, -box)) * (0.5 + ((0.5 * p.y) / 0.4000000059604644775390625))));
    wood = mix(wood, wood * 1.39999997615814208984375, float3((1.0 - smoothstep(0.0, 0.01200000010430812835693359375, abs(box + 0.01200000010430812835693359375))) * step(0.0, p.y)));
    col = mix(col, wood, float3(1.0 - smoothstep(0.0, pxs, box)));
    for (int i = 0; i < 2; i++)
    {
        float2 c = float2(0.4699999988079071044921875, 0.2199999988079071044921875 - (0.1599999964237213134765625 * float(i)));
        float d = length(p - c);
        float3 knob = mix(float3(0.119999997317790985107421875), float3(0.319999992847442626953125), float3(smoothstep(0.0500000007450580596923828125, -0.0500000007450580596923828125, (p - c).x + (p - c).y)));
        float a = 1.10000002384185791015625 + (2.2999999523162841796875 * float(i));
        float2 param_23 = p;
        float2 param_24 = c;
        float2 param_25 = c + (float2(cos(a), sin(a)) * 0.0320000015199184417724609375);
        float tick = segment(param_23, param_24, param_25) - 0.0040000001899898052215576171875;
        knob = mix(knob, float3(0.85000002384185791015625), float3(1.0 - smoothstep(0.0, pxs, tick)));
        col = mix(col, float3(0.0500000007450580596923828125), float3(0.5 * (1.0 - smoothstep(0.0, 0.00999999977648258209228515625, d - 0.0500000007450580596923828125))));
        col = mix(col, knob, float3(1.0 - smoothstep(0.0, pxs, d - 0.04500000178813934326171875)));
    }
    float2 param_26 = p - float2(0.4699999988079071044921875, -0.20000000298023223876953125);
    float2 param_27 = float2(0.0900000035762786865234375, 0.12999999523162841796875);
    float param_28 = 0.0199999995529651641845703125;
    float grille = roundBox(param_26, param_27, param_28);
    float3 slots = mix(float3(0.0599999986588954925537109375), _226.uCabinet * 0.5, float3(step(0.5, fract(p.y * 70.0))));
    col = mix(col, slots, float3(1.0 - smoothstep(0.0, pxs, grille)));
    float2 hs = float2(0.430000007152557373046875, 0.319999992847442626953125);
    float2 param_29 = p - screenC;
    float2 param_30 = hs + float2(0.0350000001490116119384765625);
    float param_31 = 0.100000001490116119384765625;
    float bezel = roundBox(param_29, param_30, param_31);
    col = mix(col, float3(0.039999999105930328369140625) + float3(0.0599999986588954925537109375 * smoothstep(0.0, -0.0350000001490116119384765625, bezel)), float3(1.0 - smoothstep(0.0, pxs, bezel)));
    float2 param_32 = p - screenC;
    float2 param_33 = hs;
    float param_34 = 0.0900000035762786865234375;
    float glass = roundBox(param_32, param_33, param_34);
    float2 q = (p - screenC) / hs;
    q *= (1.0 + (0.070000000298023223876953125 * dot(q, q)));
    float2 param_35 = (q * 0.5) + float2(0.5);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_35, _226);
    float2 param_36 = fragCoord + float2(frame);
    float3 tube = mix(pic.xyz, float3(hash12(param_36)), float3(_226.uStatic));
    float param_37 = fragCoord.y;
    float param_38 = _226.uScanlines;
    tube *= scanlines(param_37, param_38);
    tube *= (1.0 - (0.449999988079071044921875 * smoothstep(0.60000002384185791015625, 1.25, length(q))));
    float glare = smoothstep(0.3499999940395355224609375, 0.0, abs(((q.x * 0.5) + q.y) - 0.75)) * smoothstep(1.2000000476837158203125, 0.20000000298023223876953125, length(q - float2(-0.300000011920928955078125, 0.550000011920928955078125)));
    tube += float3(((_226.uGlare * 0.2199999988079071044921875) * glare) + ((_226.uGlare * 0.07999999821186065673828125) * smoothstep(0.699999988079071044921875, 1.0, q.y)));
    col = mix(col, tube, float3(1.0 - smoothstep(0.0, pxs, glass)));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), 1.0);
}

fragment flair_crt_television_frag_out flair_crt_television_frag(constant FlairUniforms& _226 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_crt_television_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _1026;
    if (_226.flair_flipY > 0.5)
    {
        _1026 = _226.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _1026 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _1026);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _226, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

