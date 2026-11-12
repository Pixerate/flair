// flair-metal-hash: c4c139e3
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

// Implementation of signed integer mod accurate to SPIR-V specification
template<typename Tx, typename Ty>
inline Tx spvSMod(Tx x, Ty y)
{
    Tx remainder = x - y * (x / y);
    return select(Tx(remainder + y), remainder, remainder == 0 || (x >= 0) == (y >= 0));
}

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
    int uLutLayout;
    int uLook;
    float uIntensity;
    float uPreserveSkinTones;
    float uSkinHue;
    float uSkinWidth;
    char _m19_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_image_lut_grade_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _85)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_85.uBackdrop) * _85.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_85.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _85)
{
    float4 _228;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _228 = overBackdrop(param, _85);
    }
    else
    {
        float2 param_1 = fract(uv);
        _228 = float4(testCard(param_1), 1.0);
    }
    return _228;
}

static inline __attribute__((always_inline))
int lutSize(constant FlairUniforms& _85, texture2d<float> uLut, sampler uLutSmplr)
{
    int2 size = int2(uLut.get_width(), uLut.get_height());
    int n = int(floor(powr(float(size.x * size.y), 0.3333333432674407958984375) + 0.5));
    bool _341 = n < 2;
    bool _356;
    if (!_341)
    {
        _356 = (size.x * size.y) != ((n * n) * n);
    }
    else
    {
        _356 = _341;
    }
    if (_356)
    {
        return 0;
    }
    bool _362 = _85.uLutLayout == 1;
    bool _379;
    if (!_362)
    {
        bool _370 = spvSMod(size.x, n) == 0;
        bool _378;
        if (_370)
        {
            _378 = spvSMod(size.y, n) == 0;
        }
        else
        {
            _378 = _370;
        }
        _379 = _378;
    }
    else
    {
        _379 = _362;
    }
    return _379 ? n : 0;
}

static inline __attribute__((always_inline))
float3 lutPoint(thread const int3& p, thread const int& n, thread const int2& size, constant FlairUniforms& _85, texture2d<float> uLut, sampler uLutSmplr)
{
    int2 xy;
    if (_85.uLutLayout == 1)
    {
        int i = (p.x + (p.y * n)) + ((p.z * n) * n);
        xy = int2(spvSMod(i, size.x), i / size.x);
    }
    else
    {
        int across = max((size.x / n), 1);
        xy = int2((spvSMod(p.z, across) * n) + p.x, ((p.z / across) * n) + p.y);
    }
    return uLut.read(uint2(int2(xy.x, (size.y - 1) - xy.y)), 0).xyz;
}

static inline __attribute__((always_inline))
float3 lookUp(thread const float3& c, thread const int& n, constant FlairUniforms& _85, texture2d<float> uLut, sampler uLutSmplr)
{
    int2 size = int2(uLut.get_width(), uLut.get_height());
    float3 f = fast::clamp(c, float3(0.0), float3(1.0)) * float(n - 1);
    int3 a = int3(floor(f));
    int3 b = min((a + int3(1)), int3(n - 1));
    float3 t = f - float3(a);
    int3 param = a;
    int param_1 = n;
    int2 param_2 = size;
    int3 param_3 = int3(b.x, a.y, a.z);
    int param_4 = n;
    int2 param_5 = size;
    float3 c00 = mix(lutPoint(param, param_1, param_2, _85, uLut, uLutSmplr), lutPoint(param_3, param_4, param_5, _85, uLut, uLutSmplr), float3(t.x));
    int3 param_6 = int3(a.x, b.y, a.z);
    int param_7 = n;
    int2 param_8 = size;
    int3 param_9 = int3(b.x, b.y, a.z);
    int param_10 = n;
    int2 param_11 = size;
    float3 c10 = mix(lutPoint(param_6, param_7, param_8, _85, uLut, uLutSmplr), lutPoint(param_9, param_10, param_11, _85, uLut, uLutSmplr), float3(t.x));
    int3 param_12 = int3(a.x, a.y, b.z);
    int param_13 = n;
    int2 param_14 = size;
    int3 param_15 = int3(b.x, a.y, b.z);
    int param_16 = n;
    int2 param_17 = size;
    float3 c01 = mix(lutPoint(param_12, param_13, param_14, _85, uLut, uLutSmplr), lutPoint(param_15, param_16, param_17, _85, uLut, uLutSmplr), float3(t.x));
    int3 param_18 = int3(a.x, b.y, b.z);
    int param_19 = n;
    int2 param_20 = size;
    int3 param_21 = b;
    int param_22 = n;
    int2 param_23 = size;
    float3 c11 = mix(lutPoint(param_18, param_19, param_20, _85, uLut, uLutSmplr), lutPoint(param_21, param_22, param_23, _85, uLut, uLutSmplr), float3(t.x));
    return mix(mix(c00, c10, float3(t.y)), mix(c01, c11, float3(t.y)), float3(t.z));
}

static inline __attribute__((always_inline))
float3 saturate0(thread const float3& c, thread const float& amount)
{
    return mix(float3(dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875))), c, float3(amount));
}

static inline __attribute__((always_inline))
float3 look(thread const float3& c, constant FlairUniforms& _85)
{
    float l = dot(c, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    if (_85.uLook == 1)
    {
        float3 tone = mix(float3(-0.070000000298023223876953125, 0.02999999932944774627685546875, 0.0900000035762786865234375), float3(0.0900000035762786865234375, 0.0199999995529651641845703125, -0.07999999821186065673828125), float3(smoothstep(0.1500000059604644775390625, 0.85000002384185791015625, l)));
        float3 param = c + tone;
        float param_1 = 1.14999997615814208984375;
        return fast::clamp(saturate0(param, param_1), float3(0.0), float3(1.0));
    }
    if (_85.uLook == 2)
    {
        float3 s = (c * c) * (float3(3.0) - (c * 2.0));
        float3 param_2 = mix(c, s, float3(0.699999988079071044921875));
        float param_3 = 1.35000002384185791015625;
        return fast::clamp(saturate0(param_2, param_3), float3(0.0), float3(1.0));
    }
    float g = smoothstep(0.0500000007450580596923828125, 0.949999988079071044921875, l);
    float3 noir = float3(0.070000000298023223876953125) + (mix(float3(g) * float3(0.959999978542327880859375, 0.980000019073486328125, 1.03999996185302734375), float3(g) * float3(1.03999996185302734375, 1.0, 0.939999997615814208984375), float3(g)) * 0.86000001430511474609375);
    return fast::clamp(mix(noir, c, float3(0.0599999986588954925537109375)), float3(0.0), float3(1.0));
}

static inline __attribute__((always_inline))
float skin(thread const float3& c, constant FlairUniforms& _85)
{
    float hi = fast::max(c.x, fast::max(c.y, c.z));
    float lo = fast::min(c.x, fast::min(c.y, c.z));
    float d = hi - lo;
    if (d < 9.9999997473787516355514526367188e-05)
    {
        return 0.0;
    }
    float _685;
    if (hi == c.x)
    {
        _685 = mod((c.y - c.z) / d, 6.0);
    }
    else
    {
        float _702;
        if (hi == c.y)
        {
            _702 = ((c.z - c.x) / d) + 2.0;
        }
        else
        {
            _702 = ((c.x - c.y) / d) + 4.0;
        }
        _685 = _702;
    }
    float h = _685;
    float off = abs(mod(((h * 60.0) - _85.uSkinHue) + 180.0, 360.0) - 180.0);
    float sat = d / fast::max(hi, 9.9999997473787516355514526367188e-05);
    return (((1.0 - smoothstep(_85.uSkinWidth * 0.5, _85.uSkinWidth, off)) * smoothstep(0.07999999821186065673828125, 0.20000000298023223876953125, sat)) * (1.0 - smoothstep(0.75, 0.949999988079071044921875, sat))) * smoothstep(0.07999999821186065673828125, 0.25, hi);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _85, texture2d<float> uLut, sampler uLutSmplr, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_85.iResolution[0], _85.iResolution[1]);
    float2 param = uv;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _85);
    int n = lutSize(_85, uLut, uLutSmplr);
    float3 _784;
    if (n > 0)
    {
        float3 param_1 = pic.xyz;
        int param_2 = n;
        _784 = lookUp(param_1, param_2, _85, uLut, uLutSmplr);
    }
    else
    {
        float3 param_3 = pic.xyz;
        _784 = look(param_3, _85);
    }
    float3 graded = _784;
    float3 param_4 = pic.xyz;
    float3 kept = mix(graded, pic.xyz, float3(_85.uPreserveSkinTones * skin(param_4, _85)));
    fragColor = float4(mix(pic.xyz, kept, float3(_85.uIntensity)), pic.w);
}

fragment flair_image_lut_grade_frag_out flair_image_lut_grade_frag(constant FlairUniforms& _85 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], texture2d<float> uLut [[texture(2)]], sampler uImageSmplr [[sampler(1)]], sampler uLutSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_image_lut_grade_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _839;
    if (_85.flair_flipY > 0.5)
    {
        _839 = _85.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _839 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _839);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _85, uLut, uLutSmplr, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

